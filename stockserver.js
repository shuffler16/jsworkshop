var http = require('http');
var https = require('https');
var querystring = require('querystring');

http.createServer(function (req, res) {

	var post_options = {
	  host: 'rdeleonlt',
	  port: 9002,
	  path: '/merchant/checkout/merchantResult',
	  method: 'POST',
	  headers: {
		'Content-Type': 'application/x-www-form-urlencoded',
		'Content-Length': post_data.length
	  }
	};
	
	var post_req = https.request(post_options, function(response) {
	  response.setEncoding('utf8');
	  response.on('data', function (chunk) {
		console.log('Response: ' + chunk);
	  });
	});

  //res.writeHead(302, {'Location': 'http://rdeleonlt:9001/mer'});
  res.end();
});
  
}).listen(15000, '127.0.0.1');
console.log('Server running at http://127.0.0.1:15000/');