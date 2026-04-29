const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });
  const [rows] = await conn.query("SELECT title, content FROM pages WHERE slug = 'kontakt'");
  console.log(rows);
  await conn.end();
}
run();
