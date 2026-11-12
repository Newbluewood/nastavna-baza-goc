/**
 * Read-only export of current CMS content into data/seed/content-seed.json.
 * Does not change MySQL. Use when you want a new first-boot factory snapshot.
 *
 *   node scripts/export-content-seed.js
 *   npm run seed:content:export
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');
const { getMysqlConnectionOptions } = require('../lib/mysqlConnectionOptions');
const { exportContentFromDb, SEED_FILE } = require('./lib/contentSeed');

async function main() {
  const opts = getMysqlConnectionOptions();
  const db = await mysql.createConnection(opts);
  try {
    const out = await exportContentFromDb(db, { sourceHost: opts.host });
    console.log(`Wrote first-boot seed (read-only export): ${out}`);
    console.log(`Same path: ${SEED_FILE}`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
