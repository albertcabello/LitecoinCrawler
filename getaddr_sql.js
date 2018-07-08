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
fs.readFile('knownHosts.txt', 'utf8', function (err, data) {
	if (err) {
		console.log('Error reading knownHosts.txt, using default host');
		queue.push('18.194.171.146');
	}
	else {
		console.log('Found a knownHosts.txt file, using those hosts to initialize crawler queue');
		queue = data.split(',');
	}
	setInterval(function () {
		if (queue.length > 0 && next > 0) {
			next--;
			crawl(queue.shift());
		}
	}, 1000);
});


/**********************************************************
*                       API BEGINS HERE                   *
**********************************************************/
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
                        res.status(400).send({error, });
                });

                peer.once('ready', () => { //Wow, you did know what you were doing
                        var messages = new Messages();
			var addrMessage = messages.Addresses([
				{
					services: new BN('d', 16),
					ip: {
						v6: '0000:0000:0000:0000:0000:ffff:835e:80f2', //camp-us-02.cis.fiu.edu IPv6 address
						v4: '131.94.128.242', //camp-us-02.cis.fiu.edu IPv4 address
					},
					port: 7474,
					time: new Date(),
				},
			]);
                        peer.sendMessage(addrMessage);
                        res.status(200).send({success: 'Done, this does not guarantee the IP got it, just that I sent it'});
                        peers[peer.host] = peer; //Add in the connection
                });

                peer.connect();
        }
        else {
		if (peer.status === Peer.STATUS.CONNECTED) {
			var messages = new Messages();
			var addrMessage = messages.Addresses([
				{
					services: new BN('d', 16),
					ip: {
						v6: '0000:0000:0000:0000:0000:ffff:835e:80f2', //camp-us-02.cis.fiu.edu IPv6 address
						v4: '131.94.128.242', //camp-us-02.cis.fiu.edu IPv4 address
					},
					port: 7474,
					time: new Date(),
				},
			]);
			peer.sendMessage(addrMessage);
			res.status(200).send({success: 'Done, this does not guarantee the IP got it, just that I sent it'});
		}
		else {
			res.status(400).send({error: 'I am not connected to that IP'});
		}
        }
});

app.listen(3000);

/*********************************************
*	    Interval to Ping Peers	     *
*********************************************/
setInterval(function() {
	for (var peer in peers) {
		http.get('http://localhost:3000/addr/'+peer, function (res) {
			//IMPLEMENT RES HERE IF NECESSARY
		});
	}
}, 1 * 60 * 1000); //Run every 10 minutes;


/************************************************
 *		Listening Server		*
 ***********************************************/
var server = net.createServer(function(socket) {
	console.log("Server: Incoming connection from", socket.remoteAddress);
	var peer = new Peer({socket: socket, network: Networks.livenet});
	addPeerEvents(peer);
	peers[peer.host] = peer;
});

/************************************************
*	Uncaught Error Handling or Exit 	*
 ***********************************************/
 process.on('uncaughtException', function(err) {
	console.log("Uncaught Exception!!!", err);
 	fs.writeFileSync('knownHosts.txt', Object.keys(peers).toString(), function(fsErr) {
		if (fsErr) {
			console.log("There was an error writing knownHosts.txt", fsErr);
		}
		console.log("knownHosts.txt was saved");
	});
 	process.exit(1);
});

server.listen(config.server.port);
