var Peer = require('litecore-p2p').Peer;
var Messages = require('litecore-p2p').Messages;
var mysql = require('mysql');
var config = require('./config.js');

var arrayPush = function(arr, callback) {
	arr.push = function(e) {
		Array.prototype.push.call(arr, e);
		callback(arr);
	};
};

var connection = mysql.createConnection({
	host	 : config.db.host,
	user	 : config.db.user,
	password : config.db.password,
	database : config.db.database,
});

connection.connect(function(err) {
	if (err) {
		console.log("Error connecting to mysql server", err);
		return;
	}
	console.log("Connected to mysql!");
	
	//Begin pushing to the queue
});

process.on('uncaughtException', function(exception) { //Update mysql table success column with 0 for the current ip since this will only get called on bad connection
	if (exception.address != undefined) {
		var query = `insert into ${config.db.table} (ip, success, error) values('${exception.address}', 0, '${exception.errno}')`;
		connection.query(query, function (err, result, field) {
			if (err) {
				console.log("Error:", err);
			}
		});
	}
});

var peers = {}; //Map of peers
var queue = []; //Pending peers


arrayPush(queue, function(updatedArr) {
	var peer = new Peer({host: queue[0]});
	var versionMessage;

	peer.on('version', function(message) {
		versionMessage = JSON.stringify(message);
	});

	peer.on('ready', function() { //Update the mysql table
		console.log("Connected to", peer.host);
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
		var query = `insert into ${config.db.table} (ip, success, getaddr, version) values('${peer.host}', 1, '${addresses}', '${versionMessage}');`
		connection.query(query, function(err, results, fields) {
			if (err) {
				console.log("Error, can't guarantee addition to database", err);
			}
		});
	});

	peer.connect();

	peers[queue.shift()] = peer; //Pop front of queue and add it to the map
});
queue.push('66.249.231.115');
queue.push('13.115.100.16');
