const RandomString = require('randomstring');

class URL {

	static shorten(db, url, callback) {
		URL.check(url.toString(), (err, newURL) => {
			if (err) {
				if (newURL) {
					return callback(null, newURL);
				}

				return callback(err);
			}

			URL.add(db, newURL, (err, hash, isNew) => {
				if (err) return callback(err);

				callback(null, hash, isNew);
			});
		});
	}

	static add(db, url, callback) {
		db.getConnection((err, connection) => {
			if (err) {
				console.log(err);
				callback('There was an error while trying to connect to the DB');
				connection.release();
				return;
			}

			const hash = RandomString.generate(7);

			// Check if we won the lottery & the hash already exists
			connection.query('SELECT id FROM links WHERE hash = "' + hash + '";', (err, rows) => {
				if (rows.length > 0) {
					connection.release();
					// Hash already exists, try again
					return URL.add(db, url, callback);
				}

				// Check if there is already a link for this hash
				connection.query('SELECT hash FROM links WHERE link = ' + db.escape(url) + ';', (err, rows) => {
					if (!err && rows.length == 1) {
						const existingHash = rows[0].hash;
						connection.release();
						// Return the existing link for the hash
						return callback(null, existingHash, false);
					}

					if (err) {
						console.log(err);
						connection.release();
						return callback('There was an error while trying to add your URL');
					}

					// Shorten the url
					connection.query('INSERT INTO links (hash, link) VALUES ("' + hash + '", ' + db.escape(url) + ');', (err) => {
						if (err) {
							console.log(err);
							return callback('There was an error while trying to add your URL');
						}

						callback(null, hash, true);

						connection.release();
					});
				});
			});
		});
	}

	static check(url, callback) {
		if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('ftp://') && !url.startsWith('www.'))
			return callback('URL must start with http://, https://, ftp:// or www.');

		if (url.startsWith('www.rfy.nz') || url.startsWith('http://rfy.nz') || url.startsWith('https://rfy.nz'))
			// This is NOT a Rickroll.
			return callback(true, 'dQw4w9W');

		if (url.length > 1000)
			return callback('Sorry, this URL is too big. The maximum length permited is 1.000 characters.');

		if (url.startsWith('http://') == false && url.startsWith('https://') == false && url.startsWith('ftp://') == false)
			url = 'http://' + url;

		callback(null, url);
	}

	static incrementClicks(db, hash) {
		db.getConnection((err, connection) => {
			if (err) {
				console.log(err);
				connection.release();
				return;
			}

			connection.query('SELECT clicks FROM links WHERE hash = "' + hash + '";', (err, rows) => {
				if (err) throw err;

				var clicks = parseInt(rows[0].clicks) + 1;

				connection.query('UPDATE links SET clicks = ' + clicks + ' WHERE hash = "' + hash + '";', (err) => {
					if (err) throw err;

					connection.release();
				});
			});
		});
	}
}

module.exports = URL;