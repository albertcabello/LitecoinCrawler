var fetch = require('node-fetch');
setInterval(() => {
	fetch('http://localhost:3000/health/100000').then((res) => {
		return res.json();
	}).then((json) => {
		console.log(json);
	}).catch((err) => {
		console.log(err);
	});
}, 5 * 1000);
