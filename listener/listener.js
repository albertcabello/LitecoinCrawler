var express = require('express');
var cors = require('cors');
var config = require('./config.js');
var net = require('net');

var sharedPeerLibrary = require('../shared/peer.js');
var modBN = require('../shared/modBN.js');
var db = require('../shared/sql.js');

var Peer = sharedPeerLibrary.litecore_p2p.Peer;
var Pool = sharedPeerLibrary.litecore_p2p.Pool;
var Networks = sharedPeerLibrary.litecore_lib.Networks;
var Messages = sharedPeerLibrary.litecore_p2p.Messages;
var Hash = sharedPeerLibrary.litecore_lib.crypto.Hash;
var BufferUtil = sharedPeerLibrary.litecore_lib.util.buffer;

var BN = modBN.BN;

/************************************************
 *		Modification of Messages	*
 ***********************************************/
Messages.prototype._buildFromBuffer = function(command, payload) {
  if (!this.builder.commands[command]) {
    //throw new Error('Unsupported message command: ' + command);
    console.log("Unrecognized command:", command);
    return false;
  }
  return this.builder.commands[command].fromBuffer(payload);
};

/************************************************
 *		Modification of Peer		*
 ***********************************************/
Peer.prototype._addSocketEventHandlers = function() {
  var self = this;

  this.socket.on('error', self._onError.bind(this));
  this.socket.on('end', self.disconnect.bind(this));

  this.socket.on('data', function(data) {
    //UNCOMMENT THIS FOR TESTING
    //console.log("RECEIVED DATA FROM", self.socket.remoteAddress, data);
    self.dataBuffer.push(data);

    if (self.dataBuffer.length > Peer.MAX_RECEIVE_BUFFER) {
      // TODO: handle this case better
      return self.disconnect();
    }
    self._readMessage();
  });
};

Peer.prototype._sendVersion = function() {
  // todo: include sending local ip address
  var message = this.messages.Version({relay: this.relay, services: new BN('d', 16), version: 70015, subversion: '/LitecoinCore:0.16.3/'});
  this.versionSent = true;
  this.sendMessage(message);
};

/************************************************
 *		Listening Server		*
 ***********************************************/
var peers = {};
var server = net.createServer(function(socket) {
	console.log("Server: Incoming connection from", socket.remoteAddress);

	var peer = new Peer({socket: socket, network: Networks.livenet});
	sharedPeerLibrary.addPeerEvents(peer);
	//Custom peer handling
	peer.on('disconnect', function() {
		console.log("Disconnected from", peer.host);
		delete peers[peer.host];
	});
	peer.on('ready', function() {
		peers[peer.host] = peer;
		console.log("Peer", peer.host, "is ready");
	});	
	peer.on('ping', function(message) {
		peer._sendPong(message.nonce);
	});
	let commands = ['version', 'verack', 'ping', 'pong', 'block', 'tx', 'getdata', 'headers', 'notfound', 'inv', 'addr',
			'alert', 'reject', 'merkleblock', 'filterload', 'filteradd', 'filterclear', 'getblocks', 'getheaders', 'mempool', 'getaddr'];
	commands.map(cmd => {
		peer.on(cmd, function(message) {
			console.log(cmd, 'from', peer.host);
		});
	});
	sharedPeerLibrary.addPeerEvents(peer);
	if (peer.host.startsWith("::ffff")) {
		peer.host = peer.host.substring(7);
	}
	peers[peer.host] = peer;
});

server.listen(config.server.port, function () {
	console.log("Opened IPv4 server on", server.address());
});
/*********************************************
*          	    API			     * 
*********************************************/
var app = express();
app.use(cors());
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

app.get('/list', function (req, res) {
	res.status(200).send(Object.keys(peers));
});

app.get('/count', function (req, res) {
	//0res.status(200).send({count: Object.keys(peers).length});
	res.status(200).send({count: pool.numberConnected});
});

app.listen(7333);

/*********************************************
*           Interval to Ping Peers           *
*********************************************/
setInterval(function() {
	for (var peer in peers) {
		console.log("Addr Interval: sending addr to", peer);
		sharedPeerLibrary.sendAddrMessage(peers[peer]);
	}
}, 10 * 60 * 1000); //Run every 10 minutes;
