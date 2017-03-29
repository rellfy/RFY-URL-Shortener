const queries = [
	"CREATE TABLE IF NOT EXISTS links (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, hash VARCHAR(7) NOT NULL, link VARCHAR(1000) NOT NULL, clicks INT(16) DEFAULT 0);"
];

const initMysql = function(db, cb) {

	db.getConnection((err, connection) => {

		var queriesExecuted = 0;

		queries.forEach((query) => {
			db.query(query, (err) => {
				if (err) throw err;

				db.query('SELECT id FROM links', function(err, rows){
					if (err) throw err;

					queriesExecuted += 1;
					if (queriesExecuted == queries.length) connection.release();

					cb(rows.length);
				});
			});
		});
	});
}


module.exports = initMysql;