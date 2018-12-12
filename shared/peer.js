var litecore_p2p = require('litecore-p2p');
var litecore_lib = require('litecore-lib');
var Messages = litecore_p2p.Messages;
var db = require('./sql.js');
var modBN = require('./modBN.js');
var connection = db.connection;
var fetch = require('node-fetch');

var BN = modBN.BN;

function sendAddrMessage(peer) {
	var messages = new Messages();
	var addrMessage = messages.Addresses([
		{
			services: new BN('d', 16),
			ip: {
				v6: '0000:0000:0000:0000:0000:ffff:835e:80f2', //camp-us-02.cis.fiu.edu IPv6 address
				v4: '131.94.128.242', //camp-us-02.cis.fiu.edu IPv4 address
			},
			port: 9332,
			time: new Date(),
		},
	]);
	peer.sendMessage(addrMessage);
}

function addPeerEvents(peer) { //The shared mysql logging for certain peer events
	var versionMessage;
	peer.connectTries = 0;
	peer.on('error', function(error) { //Peer is unreachable;
		var query = `insert into network (ip, error) values('${peer.host}', '${error.errno}')`;
		connection.query(query, function (err, result, field) {
			if (err) { console.log("Error:", err);
			}
		});
		console.log("Crawler: Error reaching", peer.host, error.errno);
	});

	peer.on('disconnect', function() {
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
				connection.query(`insert into event_log (ip, port, event) values ('${peer.host}', '${peer.port}', 'DISCONNECTED')`, function (err) {
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
		connection.query(`insert into event_log (ip, port, event) values ('${peer.host}', ${peer.port}, 'CONNECTED')`, function (err) {
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
		});
		var query = `insert into network (ip, getaddr, version) values('${peer.host}', '${addresses}', '${versionMessage}');`
		connection.query(query, function(err, results, fields) {
			if (err) {
				console.log("Error, can't guarantee addition to database", err);
			}
			console.log("Crawler: Inserted addr into mysql for", peer.host);
		});
	});

	peer.on('inv', function(message) {
		let myTime = Date.now() / 1000; //Get epoch time in seconds

		let invTypes = {0: 'ERROR', 1: 'MSG_TX', 2: 'MSG_BLOCK', 3: 'MSG_FILTERED_BLOCK', 4: 'MSG_CMPCT_BLOCK'}
		//console.log("Crawler: Got inv message from", peer.host);
		var query = `insert into inv_messages (ip, message) values('${peer.host}', '${JSON.stringify(message)}') `
		connection.query(query, function(err, results, fields) {
			if (err) {
				console.log("Error", err);
			}
		//	console.log("Crawler: Inserted inv message into mysql for", peer.host);
		});

		message.inventory.map((inv) => {
			let swapEndian = inv.hash.toString('hex').match(/../g).reverse().join(""); //Regex matches two of any character
			query = `insert into parsed_inv (ip, port, type, hash) values('${peer.host}', ${peer.port}, '${invTypes[inv.type]}', '${swapEndian}')`
			connection.query(query, function(err, results, fields) {
				if (err) {
					console.log("Crawler: Error:", err);
				}
		//		console.log("Crawler: Inserted parsed inv message into mysql for", peer.host);
			});
			fetch('https://chain.so/api/v2/get_tx/ltc/' + swapEndian).then((res) => {
				return res.json();
			}).then((json) => {
				let theirTime = json.data.time;
				console.log("Crawler: Inv Comparison:", myTime < theirTime, "Our Time:", myTime, "Their time:", theirTime, swapEndian);
				query = `insert into successes (ip, port, hash, explorerTime, ourTime, success)` + 
					` values('${peer.host}', ${peer.port}, '${swapEndian}', FROM_UNIXTIME(${theirTime})` + 
					`, FROM_UNIXTIME(${myTime}), ${(myTime < theirTime) ? 1 : 0})`
				connection.query(query, function(err, results, fields) {
					if (err) {
						console.log("Crawler: Error:", err);
					}
					console.log("Crawler: Inserted inv comparison");
				});
			}).catch((err) => { //if they don't even have the transaction, we beat them TODO: check if this is neccesary 
				console.log("ERROR:", err);
				query = `insert into successes (ip, port, hash, ourTime, success) values('${peer.host}', ${peer.port}, '${swapEndian}', '${myTime}', 1)`
				connection.query(query, function(error, results, fields) {
					if (error) {
						console.log("Crawler: Error:", error);
					}
				});
			});
		});
	});
}


module.exports = {addPeerEvents, litecore_p2p, litecore_lib, sendAddrMessage};
