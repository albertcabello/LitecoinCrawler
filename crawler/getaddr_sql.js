var express = require('express');
var cors = require('cors');
var http = require('http');
var net = require('net');
var fs = require('fs');

var db = require('../shared/sql.js');
var modBN = require('../shared/modBN.js');
var sharedPeerLibrary = require('../shared/peer.js');

var Peer = sharedPeerLibrary.litecore_p2p.Peer;
var Pool = sharedPeerLibrary.litecore_p2p.Pool;
var Messages = sharedPeerLibrary.litecore_p2p.Messages;
var Networks = sharedPeerLibrary.litecore_lib.Networks;

var connection = db.connection;
var BN = modBN.BN;

/************************************************
 *                      Crawler                 *
 ***********************************************/
function crawl(seed) {
	if (!peers[seed]) {
		var peer = new Peer({host: seed});
		sharedPeerLibrary.addPeerEvents(peer);
		peer.on('error', function(err) {
			next++;
			connectionLog.unshift(0);
		});
		peer.on('disconnect', function() {
			delete peers[peer.host];
		});
		peer.on('ready', function() {
			peers[peer.host] = peer;
			successfulNumberOfConnections++;
			connectionLog.unshift(1);
		});	
		peer.on('addr', function(message) {
			next++;
			message.addresses.forEach(function(address) {
				if (!(peers.hasOwnProperty(address.ip.v4)) || queue.includes(address.ip.v4) ) { //Saves memory on the queue by preventing adding duplicates
					queue.push(address.ip.v4);
				}
			});

		});
		peer.connect();
	}
}

/**********************************************************
 *			Initialize Crawler 	  	  *
 *********************************************************/
var peers = {}; //Map of peers
var queue = [];
var next = 10;
var totalNumberOfConnections = 0;
var successfulNumberOfConnections = 0;
var connectionLog = [];
connection.query(`insert into event_log (ip, port, event) values ('0.0.0.0', 0, 'STARTUP')`, function (err, results, fields) {
	if (err) {
		console.log("Could not log startup of the crawler");
	}
	else {
		console.log("Started event logging");
	}
});

connection.query(`select ip from active_peer`, function (err, results, fields) {
	if (err) {
		console.log("Could not recover peers, starting from known beginning, make sure MySQL is up", err);
	}
	else {
		queue = results.map(obj => obj.ip);
	}

	if (queue.length === 0) { //If at this point queue is empty, join a pool for some people
		console.log("Joining a pool");
		//Connect to a pool to get people
		var pool = new Pool({network: Networks.livenet});
		pool.connect();
		pool.on('peerinv', function(peer, message) {
			queue.push(peer.host);
		});
	}
	setInterval(function () {
		if (queue.length > 0 && next > 0) {
			next--;
			totalNumberOfConnections++;
			crawl(queue.shift());
		}
	}, 1000);
});
/**********************************************************
*                       API BEGINS HERE                   *
**********************************************************/
var app = express();
app.use(cors()); //Allows CORS
app.get('/ping/:ip', function (req, res) {
        var peer = peers[req.params.ip];
        if (peer === undefined) {
                res.status(500).send( { error: 'IP is not in the crawl set' });
        }
        else {
                //This can only occur once to
                //a) prevent a header failure in express
                //b) prevent this from being called in future pings that aren't relevant to this route
                peer.once('pong', function () {
                        res.send( { success: 'Received ping reply from the ip' });
                });

                var messages = new Messages();
                var pingMessage = messages.Ping();
                peer.sendMessage(pingMessage);
        }
});

app.get('/addr/:ip', function (req, res) {
        var peer = peers[req.params.ip];
	console.log("API: Received request", req.params.ip);
        if (peer === undefined) { //Peer doesn't exist, hopefully you know what you're doing
                peer = new Peer({host: req.params.ip});

                //This can only occur once to
                //a) prevent a header failure in express
                //b) prevent this from being called again in the usual addr calls
                peer.once('error', (error) => { //Looks like you don't know what you're doing if you got here
                        res.status(400).send({error: error });
                });

                peer.once('ready', () => { //Wow, you did know what you were doing
                        sharedPeerLibrary.sendAddrMessage(peer);
                        res.status(200).send({success: 'Done, this does not guarantee the IP got it, just that I sent it'});
                        peers[peer.host] = peer; //Add in the connection
                });

                peer.connect();
        }
        else {
		if (peer.status === Peer.STATUS.READY) {
			sharedPeerLibrary.sendAddrMessage(peer);
			res.status(200).send({success: 'Done, this does not guarantee the IP got it, just that I sent it'});
		}
		else {
			res.status(400).send({error: 'I am not connected to that IP or that IP is not ready'});
		}
        }
});

app.get('/efficiency', function (req, res) {
	console.log("API: Received efficiency request");
	if (totalNumberOfConnections) {
		res.status(200).send({efficiency: successfulNumberOfConnections * 1.0 / totalNumberOfConnections, count: Object.keys(peers).length});
	}
	else {
		res.status(400).send({error: 'It is too soon to get the efficiency, it is a division by zero'});
	}
});

app.get('/efficiency/:total', function (req, res) {
	console.log("API: Received efficiency request");
	let count = 0;
	for (let i = 0; i < req.params.total && i < connectionLog.length; i++) {
		count += connectionLog[i];
	}
	res.status(200).send({efficiency: count / totalNumberOfConnections});
});

app.listen(7334);

/*********************************************
*	    Interval to Ping Peers	     *
*********************************************/
setInterval(function() {
	for (var peer in peers) {
		console.log("Addr Interval: sending addr to", peer);
		sharedPeerLibrary.sendAddrMessage(peers[peer]);
	}
}, 10 * 60 * 1000); //Run every 10 minutes;

/************************************************
*	Uncaught Error Handling or Exit 	*
 ***********************************************/
//This is only here for the case where MySQL may be down.  At which point, knownHosts will have the most recent list of peers
//as of the last crawler crash. 
function flushPeers() {
 	fs.writeFile('knownHosts.txt', Object.keys(peers).toString(), function(fsErr) {
		if (fsErr) {
			console.log("There was an error writing knownHosts.txt", fsErr);
		}
		else {
			console.log("knownHosts.txt was saved");
		}
		process.exit(1);
	});
}

process.on('uncaughtException', function(err) {
	console.log("Uncaught Exception!!!", err);
	flushPeers();
});

process.on('SIGUSR2', function() {
	flushPeers();
	console.log("Restarting");
});
