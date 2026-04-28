require('dotenv').config()
const mysql = require('mysql2/promise')
const { getMysqlConnectionOptions } = require('./lib/mysqlConnectionOptions')

;(async () => {
  const dbConfig = getMysqlConnectionOptions({ skipDatabase: true })
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
