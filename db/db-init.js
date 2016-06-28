var queries = [
				"CREATE TABLE IF NOT EXISTS links (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, hash VARCHAR(7) NOT NULL, link VARCHAR(1000) NOT NULL, clicks INT(16) DEFAULT 0);"
			  ];
module.exports = queries;