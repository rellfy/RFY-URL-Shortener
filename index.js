var express = require('express'),
    app = express(),
    http = require('http').createServer(app),
    io = require('socket.io').listen(http),
	bodyParser = require('body-parser'),
	slashes = require('connect-slashes'),
	fs = require('fs'),
	randomstring = require("randomstring"),
	colors = require('colors'),
	mysql = require('mysql'),
	db_settings = require('./db/conn-info.js'),
	db_queries = require('./db/db-init.js'),
	db = mysql.createPool(db_settings),
	prefix = '['.grey + 'RFY'.red + '] '.grey;
	path = (__dirname + '/client');

app.use(bodyParser.json()); 

app.use(bodyParser.urlencoded({extended:true}));

app.use(slashes(false));

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

//app.set('views', path);
//
//app.set('view engine', 'ejs');

app.get('/', function (req, res){
	res.sendFile(path + '/index.html');
	var hostname = req.headers.host.split(":")[0];
});

app.get('*', function (req, res){
	fs.stat(path + req.url, function(err, stat) {
		if (req.url.startsWith("/library/"))
		{
			if (err == null)
			{
				res.sendFile(path + req.url);
			}
			else if (err.code == "ENOENT")
			{
				res.sendFile(path + "/404.html");
			}
			else
			{
				res.sendFile(path + "/500.html");
			}
		}
		else if (err == null)
		{
			var fPath;
			if (req.url.indexOf(".") === -1)
			{
				res.redirect('/');
			}
			else
			{
				fPath = path + req.url;
				fs.stat(fPath, function(err, stat) {
					if (err == null)
					{
						res.sendFile(fPath);
					}
					else if (err.code == "ENOENT")
					{
						res.sendFile(path + '/404.html');
					}
					else
					{
						res.sendFile(path + '/500.html');
					}
				});
			}
		}
		else if (err.code == 'ENOENT')
		{
			var start = new Date().getTime();
			var hash = req.url.replace(/\//, '');
			db.getConnection(function(err, connection){
				if (err)
				{
					console.log(err);
					connection.release();
				}
				else
				{
					db.query('SELECT link FROM links WHERE hash = ' + db.escape(hash) + ';', function(err, rows){
						if (rows.length > 0)
						{
							res.redirect(rows[0].link);
							// incrementClicks(rows[0].link);
						}
						else
						{
							res.redirect('/');
						}
						var time = new Date().getTime() - start;
						console.log(prefix + 'Query took ' + (time / 1000).toFixed(2) + 's (hash: ' + hash + ')');
						connection.release();
					});
				}
			})
		}
		else
		{
			res.sendFile(path + '/500.html');
		}
	});
});

http.listen(80);

console.log(prefix + 'HTTP Listening!');

var TOTAL_LINKS = null;

db.getConnection(function(err, connection) {
	db.query(db_queries[0], function(err) {
		if (err) throw err;
		console.log(prefix + 'Database Initializated!');
		db.query('SELECT id FROM links', function(err, rows){
			if (err) throw err;
			TOTAL_LINKS = rows.length;
			console.log(prefix + 'Total links shortened: ' + TOTAL_LINKS);
			connection.release();
		});
	});
});

io.sockets.on('connection', function(socket){

	socket.on('handshake', function(){
		socket.emit('get_totalinks', TOTAL_LINKS);
	});

	socket.on('shorten', function(url){
		var start = new Date().getTime();
		shortenURL(url, function(err, hash){
			if (err)
			{
				socket.emit('complete', {err:err,hash:null});
				var time = new Date().getTime() - start;
				console.log(prefix + 'Query took ' + (time / 1000).toFixed(2) + 's (error)');
			}
			else
			{
				var time = new Date().getTime() - start;
				console.log(prefix + 'Query took ' + (time / 1000).toFixed(2) + 's (hash: ' + hash + ')');
				socket.emit('complete', {err:null,hash:hash});
			}
		});
	});

});


function shortenURL(url, callback)
{
	verifyURL(url.toString(), function(err, newURL){
		if (err)
		{
			if (newURL)
			{
				callback(null, newURL);
			}
			else
			{
				callback(err);
			}
		}
		else
		{
			addURL(newURL, function(err, hash){
				if (!err)
				{
					callback(null, hash);
				}
				else
				{
					callback(err);
				}
			});
		}
	});
}

function addURL(url, callback)
{
	db.getConnection(function(err, connection){
		if (err)
		{
			console.log(err);
			callback('There was an error while trying to connect to the DB');
			connection.release();
		}
		else
		{
			// Check if we won the lottery & if the hash exists
			var hash = randomstring.generate(7);
			db.query('SELECT id FROM links WHERE hash = "' + hash + '";', function(err, rows){
				if (rows.length > 0)
				{
					addURL(url, callback);
					connection.release();
				}
				else
				{
					// Check if this url was already shortened
					db.query('SELECT hash FROM links WHERE link = ' + db.escape(url) + ';', function(err, rows){
						if (!err && rows.length == 1)
						{
							var existing_hash = rows[0].hash;
							callback(null, existing_hash);
							connection.release();
						}
						else if (!err)
						{
							// Shortens the url
							db.query('INSERT INTO links (hash, link) VALUES ("' + hash + '", ' + db.escape(url) + ');', function(err){
								if (err)
								{
									console.log(err);
									callback('There was an error while trying to add your URL');
								}
								else
								{
									callback(null, hash);
									TOTAL_LINKS++;
									io.emit('get_totalinks', TOTAL_LINKS);
								}
								connection.release();
							});
						}
						else
						{
							console.log(err);
							callback('There was an error while trying to add your URL');
							connection.release();
						}
					})
				}
			})
		}
	});
}

function verifyURL(url, callback)
{
	if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('ftp://') || url.startsWith('www.'))
	{
		if (url.startsWith('www.rfy.nz') || url.startsWith('http://rfy.nz') || url.startsWith('https://rfy.nz'))
		{
			callback(true, 'rVm9ZT5');
		}
		else
		{
			if (url.length > 1000)
			{
				callback('Sorry, this URL is too big. The maximum length permited is 1.000 characters.');
			}
			else
			{
				if (url.startsWith('http://') == false && url.startsWith('https://') == false && url.startsWith('ftp://') == false)
				{
					url = 'http://' + url;
				}
				callback(null, url);
			}
		}
	}
	else
	{
		callback("URL must start with http://, https://, ftp:// or www.");
	}

}