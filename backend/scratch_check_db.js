const mysql = require('mysql2/promise');
const { getMysqlConnectionOptions } = require('./lib/mysqlConnectionOptions');

async function checkAivenDb() {
  let connection;
  try {
    connection = await mysql.createConnection(getMysqlConnectionOptions());

    console.log('Connected to database successfully.');

    const [tables] = await connection.query('SHOW TABLES');
    console.log('Tables in database:', tables.map(t => Object.values(t)[0]));

    if (tables.some(t => Object.values(t)[0] === 'hero_slides')) {
        const [slides] = await connection.query('SELECT * FROM hero_slides');
        console.log('\nHero Slides:', slides);
    } else {
        console.log('\nNo hero_slides table found.');
    }

    if (tables.some(t => Object.values(t)[0] === 'themes')) {
        const [themes] = await connection.query('SELECT id, slug, icon, hero_image FROM themes');
        console.log('\nThemes:', themes);
    } else {
        console.log('\nNo themes table found.');
    }
    
    if (tables.some(t => Object.values(t)[0] === 'news')) {
        const [news] = await connection.query('SELECT id, title, cover_image FROM news LIMIT 5');
        console.log('\nNews:', news);
    } else {
        console.log('\nNo news table found.');
    }

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('Error connecting to Aiven database:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

checkAivenDb();
