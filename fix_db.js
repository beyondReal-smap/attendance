const mysql = require('mysql2/promise');

// 환경 변수에서 DB 정보 가져오기
const dbConfig = {
  host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || process.env.DB_PORT) || 3306,
  user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'attendance',
};

async function fixDatabase() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);

    console.log('Adding is_admin column...');
    await connection.execute(`
      ALTER TABLE atnd_users ADD COLUMN IF NOT EXISTS is_admin TINYINT(1) DEFAULT 0
    `);

    console.log('Database fix completed successfully!');
    console.log('You can now refresh the page to see the leave status.');

  } catch (error) {
    console.error('Database fix error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixDatabase();
