var config = require('./config.js');
var net = require('net');

var sharedPeerLibrary = require('../shared/peer.js');
var modBN = require('../shared/modBN.js');
var db = require('../shared/sql.js');

var Peer = sharedPeerLibrary.litecore_p2p.Peer;
var Pool = sharedPeerLibrary.litecore_p2p.Pool;
var Networks = sharedPeerLibrary.litecore_lib.Networks;
var Messages = sharedPeerLibrary.litecore_p2p.Messages;

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
 *		Listening Server		*
 ***********************************************/
var peers = {};

var serverPeers = [];
var server = net.createServer(function(socket) {
	console.log("Server: Incoming connection from", socket.remoteAddress);
	var peer;
	try {
		var peer = new Peer({socket: socket, network: Networks.livenet});
	}
	catch (e) {
		console.log("Could not turn connection to peer, maybe it's not a peer?", e);
		socket.destroy();
	}
	sharedPeerLibrary.addPeerEvents(peer);
	//Custom peer handling
	peer.on('disconnect', function() {
		delete peers[peer.host];
	});
	peer.on('ready', function() {
		peers[peer.host] = peer;
	});

	addPeerEvents(peer);
	if (peer.host.startsWith("::ffff")) {
		peer.host = peer.host.substring(7);
	}
	peers[peer.host] = peer;
	serverPeers.push(peer.host);
});

server.listen(config.server.port, function () {
	console.log("Opened IPv4 server on", server.address());
});

/*********************************************
*           Interval to Ping Peers           *
*********************************************/
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

setInterval(function() {
	for (var peer in peers) {
		console.log("Addr Interval: sending addr to", peer);
		sendAddrMessage(peers[peer]);
	}
}, 10 * 60 * 1000); //Run every 10 minutes;
