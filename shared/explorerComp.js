/*
Compares the times that different crawlers get a certain transaction.  Just for testing purposes
*/
var fetch = require('node-fetch');

var explorers = ['https://chain.so/api/v2/get_tx/ltc/', 'https://api.blockcypher.com/v1/ltc/main/txs/'];

fetch(explorers[0] + process.argv[2]).then((res) => {
	return res.json();
}).then((json) => {
	let time = new Date(json.data.time * 1000);
	console.log("chain.so", time);
});

fetch(explorers[1] + process.argv[2]).then((res) => {
	return res.json();
}).then((json) => {
	let time = new Date(json.received);
	console.log("live.blockcypher.com", time);
});
