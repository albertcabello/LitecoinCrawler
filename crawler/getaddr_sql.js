var express = require('express');
var Peer = require('litecore-p2p').Peer;
var Pool = require('litecore-p2p').Pool;
var Networks = require('litecore-lib').Networks;
var BN = require('bn.js');
var Messages = require('litecore-p2p').Messages;
var mysql = require('mysql');
var config = require('./config.js');
var http = require('http');
var net = require('net');
var fs = require('fs');

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
 *		Modification of BN.js		*
 ***********************************************/
BN.prototype.toBuffer = function(opts) {
	var buf, hex;
	if (opts && opts.size) {
		hex = this.toString(16, 2);
		var natlen = hex.length / 2;
		buf = new Buffer(hex, 'hex');

		if (natlen === opts.size) {
			buf = buf;
		} else if (natlen > opts.size) {
			buf = BN.trim(buf, natlen);
		} else if (natlen < opts.size) {
			buf = BN.pad(buf, natlen, opts.size);
		}
	} else {
		hex = this.toString(16, 2);
		buf = new Buffer(hex, 'hex');
	}

	if (typeof opts !== 'undefined' && opts.endian === 'little') {
		buf = reversebuf(buf);
	}

	return buf;
};

BN.pad = function(buf, natlen, size) {
	var rbuf = new Buffer(size);
	for (var i = 0; i < buf.length; i++) {
		rbuf[rbuf.length - 1 - i] = buf[buf.length - 1 - i];
	}
	for (i = 0; i < size - natlen; i++) {
		rbuf[i] = 0;
	}
	return rbuf;
};

/************************************************
 *                      Crawler                 *
 ***********************************************/
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
		connectionLog.unshift(0);
	});

	peer.on('disconnect', function() {
		delete peers[peer.host];
		setTimeout(function() {
			if (peer.connectTries < 2) { //Connect three times, if we got here, it's been 1 already
				var query = `update active_peer set retries = ${peer.connectTries} where ip = '${peer.host}'`;
				connection.query(query, function(err, results, fields) {
					if (err) {
						console.log("Error, can't guarantee addition to database", err);
					}
					console.log("Crawler: Updated MySQL number of tries on", peer.host);
				});
				console.log("Crawler: Connecting to", peer.host, "for the", peer.connectTries+2, "time");
				peer.connectTries++;
				peer.connect();
			}
			else {
				var query = `delete from active_peer where ip = '${peer.host}'`;
				connection.query(query, function(err, results, fields) {
					if (err) {
						console.log("Error, can't guarantee removal from database", err);
					}
					console.log("Crawler: Removed", peer.host, "from list of peers in MySQL");
				});
				connection.query(`insert into eventLog (ip, port, event) values ('${peer.host}', '${peer.port}', 'DISCONNECTED')`, function (err) {
					if (err) {
						console.log("Error, can't guarantee addition to database", err);
					}
					console.log("Crawler: Added disconnect to event log for", peer.host, ":", peer.port);
				});
			}
		}, 5000);
	});

	peer.on('version', function(message) {
		versionMessage = JSON.stringify(message);
	});

	peer.on('ready', function() { //Update the mysql table
		console.log("Crawler: Connected to", peer.host);
		peers[peer.host] = peer;
		successfulNumberOfConnections++;
		connectionLog.unshift(1);
		var messages = new Messages();
		var message = messages.GetAddr();
		peer.sendMessage(message);
		var query = `insert into active_peer (ip, retries) values ('${peer.host}', 0) on duplicate key update retries = 0`;
		connection.query(query, function(err, results, fields) {
			if (err) {
				console.log("Error, can't guarantee addition to database", err);
			}
			console.log("Crawler: Marked IP as visited", peer.host);
		});
		connection.query(`insert into eventLog (ip, port, event) values ('${peer.host}', ${peer.port}, 'CONNECTED')`, function (err) {
			if (err) {
				console.log("Error, can't guarantee addition to database", err);
			}
			console.log("Crawler: Added IP to the event log", peer.host);
		});
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
		next++;
	});
}

function crawl(seed) {
	if (!peers[seed]) {
		var peer = new Peer({host: seed});
		addPeerEvents(peer);
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
connection.query(`insert into eventLog (ip, port, event) values ('0.0.0.0', 0, 'STARTUP')`, function (err, results, fields) {
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
		queue.push('18.194.171.146');
	}
	else {
		queue = results.map(obj => obj.ip);
		if (queue.length === 0) {
			queue.push('18.194.171.146');
		}
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
function sendAddrMessage(peer) {
	var messages = new Messages();
	var addrMessage = messages.Addresses([
		{
			services: new BN('d', 16),
			ip: {
				v6: '0000:0000:0000:0000:0000:ffff:835e:80f2', //camp-us-02.cis.fiu.edu IPv6 address
				v4: '131.94.128.242', //camp-us-02.cis.fiu.edu IPv4 address
			},
			port: 7334,
			time: new Date(),
		},
	]);
	peer.sendMessage(addrMessage);
}

var app = express();
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
                        sendAddrMessage(peer);
                        res.status(200).send({success: 'Done, this does not guarantee the IP got it, just that I sent it'});
                        peers[peer.host] = peer; //Add in the connection
                });

                peer.connect();
        }
        else {
		if (peer.status === Peer.STATUS.READY) {
			sendAddrMessage(peer);
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
		res.status(200).send({efficiency: successfulNumberOfConnections * 1.0 / totalNumberOfConnections});
	}
	else {
		res.status(400).send({error: 'It is too soon to get the efficiency, it is a division by zero'});
	}
});

app.get('/efficiency/:total', function (req, res) {
	console.log("API: Received efficiency request");
	let count = 0;
	for (let i = 0; i < req.params.total; i++) {
		count += connectionLog[i];
	}
	res.status(200).send({efficiency: count / totalNumberOfConnections});
});

app.listen(3000);

/*********************************************
*	    Interval to Ping Peers	     *
*********************************************/
setInterval(function() {
	for (var peer in peers) {
		console.log("Addr Interval: sending addr to", peer);
		sendAddrMessage(peers[peer]);
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
