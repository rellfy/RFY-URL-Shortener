// Requires
const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io').listen(http);
const bodyParser = require('body-parser');
const slashes = require('connect-slashes');
const fs = require('fs');
const mysql = require('mysql');

// DB
const dbConfig = require('./config.js').db;
const dbInit = require('./mysql-init.js');
const db = mysql.createPool(dbConfig);

// URL Manager
const URL = require('./URL.js');

// Others
const prefix = '[urlShortener] ';
const path = (__dirname + '/client');
var TOTAL_LINKS = 0;

// App setup
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({extended:true}));
app.use(slashes(false));
app.use((request, response, next) => {
  response.header('Access-Control-Allow-Origin', '*');
  response.header('Access-Control-Allow-Headers', 'Origin, X-requestuested-With, Content-Type, Accept');
  next();
});

// Routes
app.get('/', function (request, response){
	response.sendFile(path + '/index.html');
});

app.get('/library/:fileName', (request, response) => {
	const fileName = request.params.file;

	if (request.params.fileName.includes('../')) return response.status(400).send('Invalid request');

	fs.stat(path + request.url, (err, stats) => {
		if (err) return response.sendFile(path + '/404.html');

		response.sendFile(path + request.url);
	});
});

app.get('*', (request, response) => {
	const startTime = new Date().getTime();
	const hash = request.url.replace(/\//, '');

	db.getConnection(function(err, connection){
		if (err) {
			console.log(err);
			connection.release();
			reply.status(500).send('Server error');
			return;
		}

		db.query('SELECT link FROM links WHERE hash = ' + db.escape(hash) + ';', function(err, rows){
			const totalTime = new Date().getTime() - startTime;
			console.log(prefix + 'Query took ' + (totalTime / 1000).toFixed(2) + 's (hash: ' + hash + ')');
			connection.release();

			if (rows.length < 1) return response.redirect('/');

			response.redirect(rows[0].link);
			URL.incrementClicks(db, hash);
		});
	})
});

http.listen(80);
console.log(prefix + 'HTTP server listening on port 80');

dbInit(db, (linkQuantity) => {
	console.log(prefix + 'Database was initialized');
	TOTAL_LINKS = linkQuantity;
});

io.sockets.on('connection', (socket) => {

	socket.on('handshake', () =>{
		socket.emit('get_totalinks', TOTAL_LINKS);
	});

	socket.on('shorten', (url) => {
		const startTime = new Date().getTime();

		URL.shorten(db, url, (err, hash, isNew) => {
			if (err) {
				socket.emit('complete', { err:err, hash:null });
				const totalTime = new Date().getTime() - startTime;
				console.log(prefix + 'Query took ' + (totalTime / 1000).toFixed(2) + 's (error)');
				return;
			}

			if (isNew) {
				TOTAL_LINKS += 1;
				io.emit('get_totalinks', TOTAL_LINKS);
			}

			const totalTime = new Date().getTime() - startTime;
			console.log(prefix + 'Query took ' + (totalTime / 1000).toFixed(2) + 's (hash: ' + hash + ')');
			socket.emit('complete', { err:null, hash:hash });
		});
	});
});