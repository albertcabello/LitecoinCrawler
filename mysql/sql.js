var mysql = require('mysql');
var config = require('./config.js');

var connection = mysql.createConnection({
	host	: config.db.host,
	user	: config.db.user,
	port	: config.db.port,
	password: config.db.password,
	database: config.db.database
});

connection.connect(function(err) {
	if (err) {
		throw err;
	}
	console.log("Connected to mysql!");
});

var tables = {
	activePeersTable : "CREATE TABLE IF NOT EXISTS `active_peer` (`ip` varchar(15) NOT NULL, `retries` tinyint(4) DEFAULT NULL," + 
	  "PRIMARY KEY (`ip`))",

	eventLogTable : "CREATE TABLE IF NOT EXISTS `event_log` (" +
	  "`timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," + 
	  "`ip` varchar(15) NOT NULL," + 
	  "`port` smallint(6) DEFAULT NULL," + 
	  "`event` varchar(100) DEFAULT NULL," + 
	  "PRIMARY KEY (`ip`,`timestamp`))" ,

	invMessagesTable : "CREATE TABLE IF NOT EXISTS `inv_messages` (" + 
	  "`ip` varchar(15) DEFAULT NULL," + 
	  "`message` varchar(10000) DEFAULT NULL," + 
	  "`timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)",

	networkTable : "CREATE TABLE IF NOT EXISTS `network` (" + 
	  "`ip` varchar(15) NOT NULL," + 
	  "`checked` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," + 
	  "`getaddr` text," + 
	  "`version` varchar(1000) DEFAULT NULL," + 
	  "`error` varchar(100) DEFAULT NULL," + 
	  "PRIMARY KEY (`ip`,`checked`))",

	parsedInvTable : "CREATE TABLE IF NOT EXISTS `parsed_inv` (" + 
	  "`ip` varchar(16) DEFAULT NULL," + 
	  "`port` smallint(5) unsigned DEFAULT NULL," + 
	  "`type` varchar(20) DEFAULT NULL," + 
	  "`hash` varchar(70) DEFAULT NULL," + 
	  "`timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)",
}

for (var table in tables) {
	connection.query(tables[table], function(err) {	
		if (err) throw err;
	});
}

module.exports = {connection};
