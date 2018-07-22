var Peer = require('litecore-p2p').Peer;
var Pool = require('litecore-p2p').Pool;
var Networks = require('litecore-lib').Networks;
var Messages = require('litecore-p2p').Messages;
var config = require('./config.js');
var net = require('net');
var mysql = require('mysql');

/************************************************
 *		Initialize MySQL Connection	*
 ***********************************************/
var connection = mysql.createConnection({
        host     : config.db.host,
        user     : config.db.user,
	port	 : config.db.port,
        password : config.db.password,
        database : config.db.database,
});

connection.connect(function(err) {
        if (err) {
		console.log("Error connecting to mysql server", err);
		return;
	}
	console.log("Connected to mysql!");
});

/************************************************
 *		Listening Server		*
 ***********************************************/
var peers = {};

function addPeerEvents(peer) {
	var versionMessage;
	peer.connectTries = 0;
	peer.on('error', function(error) { //Peer is unreachable;
		var query = `insert into ${config.db.table} (ip, error) values('${peer.host}', '${error.errno}')`;
		connection.query(query, function (err, result, field) {
			if (err) {
				console.log("Error:", err);
			}
		});
		console.log("Crawler: Error reaching", peer.host, error.errno);
		next++;
	});

	peer.on('disconnect', function() {
		delete peers[peer.host];
		setTimeout(function() {
			if (peer.connectTries < 2) { //Connect three times, if we got here, it's been 1 already
				console.log("Crawler: Connecting to", peer.host, "for the", peer.connectTries+2, "time");
				peer.connectTries++;
				peer.connect();
			}
		}, 5000);
	});

	peer.on('version', function(message) {
		versionMessage = JSON.stringify(message);
	});

	peer.on('ready', function() { //Update the mysql table
		console.log("Crawler: Connected to", peer.host);
		peers[peer.host] = peer;
		var messages = new Messages();
		var message = messages.GetAddr();
		peer.sendMessage(message);
	});

	peer.on('addr', function(message) {
		var addresses = "";
		message.addresses.forEach(function(address) {
			addresses += address.ip.v4 + ",";
			queue.push(address.ip.v4);
		});
		var query = `insert into ${config.db.table} (ip, getaddr, version) values('${peer.host}', '${addresses}', '${versionMessage}');`
		connection.query(query, function(err, results, fields) {
			if (err) {
				console.log("Error, can't guarantee addition to database", err);
			}
			console.log("Crawler: Inserted addr into mysql for", peer.host);
		});
	});
}

var serverPeers = [];
var server = net.createServer(function(socket) {
	console.log("Server: Incoming connection from", socket.remoteAddress);
	var peer = new Peer({socket: socket, network: Networks.livenet});
	addPeerEvents(peer);
	peers[peer.host] = peer;
	serverPeers.push(peer.host);
});

server.listen(config.server.port, function () {
	console.log("Opened IPv4 server on", server.address());
});
