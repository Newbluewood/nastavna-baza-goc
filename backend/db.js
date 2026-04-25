require('dotenv').config()
const mysql = require('mysql2/promise')
const { getMysqlPoolOptions } = require('./lib/mysqlConnectionOptions')

const pool = mysql.createPool(getMysqlPoolOptions())

module.exports = pool
