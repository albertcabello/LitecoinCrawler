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

process.on('uncaughtException', function(exception) { //Update mysql table success column with 0 for the current ip since this will only get called on bad connection
	process.exit();
});

var peers = {}; //Map of peers
var queue = []; //Pending peers

arrayPush(queue, function(updatedArr) {
	var peer = new Peer({host: queue[0]}); //Get front of the queue

	peer.on('ready', function() { //Update the mysql table
		console.log("Connected to", peer.host);
		var messages = new Messages();
		var message = messages.GetAddr();
		peer.sendMessage(message);
	});

	peer.on('addr', function(message) {
		console.log(peer.host, "has received a getaddr message");
		message.addresses.forEach(function(address) {
			queue.push(address.ip.v4);
		});
	});

	peer.connect(); //Connect to the peer if possible

	peers[queue.shift()] = peer; //Pop front of queue and add it to the map
});
queue.push('66.249.231.115');
queue.push('13.115.100.16');
