require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const EXECUTE_FLAG = '--execute';

function hasExecuteFlag(argv = process.argv) {
  return argv.includes(EXECUTE_FLAG);
}

function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'baza_goc',
    port: process.env.DB_PORT || 3306,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });
}

async function executeOrPrint(connection, sql, params, description, shouldExecute) {
  if (shouldExecute) {
    await connection.query(sql, params);
    console.log(`EXECUTED: ${description}`);
    return;
  }

  console.log(`DRY-RUN: ${description}`);
  console.log(`  SQL: ${sql}`);
  if (params && params.length) {
    console.log(`  PARAMS: ${JSON.stringify(params)}`);
  }
}

async function resetApplicationTables(connection, shouldExecute) {
  const tablesInOrder = [
    'hero_slides_translations',
    'news_translations',
    'page_translations',
    'room_translations',
    'facility_translations',
    'media_gallery',
    'reservations',
    'inquiries',
    'rooms',
    'facilities',
    'hero_slides',
    'news',
    'guests',
    'pages',
    'admins'
  ];

  await executeOrPrint(connection, 'SET FOREIGN_KEY_CHECKS = 0', [], 'disable foreign key checks', shouldExecute);

  for (const tableName of tablesInOrder) {
    await executeOrPrint(connection, `TRUNCATE TABLE \`${tableName}\``, [], `truncate ${tableName}`, shouldExecute);
  }

  await executeOrPrint(connection, 'SET FOREIGN_KEY_CHECKS = 1', [], 'enable foreign key checks', shouldExecute);
}

async function seedAdmin(connection, shouldExecute) {
  const username = process.env.ADMIN_SEED_USERNAME || 'admin';
  const password = process.env.ADMIN_SEED_PASSWORD || 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);

  await executeOrPrint(
    connection,
    'INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, NOW())',
    [username, passwordHash],
    `seed admin user ${username}`,
    shouldExecute
  );

  return { username, password };
}

async function seedBasePages(connection, shouldExecute) {
  const pages = [
    ['pocetna', 'Наставна база Гоч', 'Почетна презентациона страница.'],
    ['smestaj', 'Смештај', 'Основне информације о смештају.']
  ];

  for (const page of pages) {
    await executeOrPrint(
      connection,
      'INSERT INTO pages (slug, title, content) VALUES (?, ?, ?)',
      page,
      `seed page ${page[0]}`,
      shouldExecute
    );
  }
}

module.exports = {
  EXECUTE_FLAG,
  hasExecuteFlag,
  createConnection,
  executeOrPrint,
  resetApplicationTables,
  seedAdmin,
  seedBasePages
};