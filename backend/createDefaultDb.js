require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  };
  try {
    const conn = await mysql.createConnection(dbConfig);
    await conn.query('CREATE DATABASE IF NOT EXISTS `defaultdb`');
    console.log('Database `defaultdb` created or already exists.');
    await conn.end();
  } catch (err) {
    console.error('Failed to create database:', err.message);
    process.exit(1);
  }
})();
