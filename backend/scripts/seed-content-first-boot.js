/**
 * First-boot content seed from data/seed/content-seed.json.
 * Inserts only into EMPTY content tables. Never overwrites a live CMS.
 *
 *   node scripts/seed-content-first-boot.js           # dry-run
 *   node scripts/seed-content-first-boot.js --execute # insert only where empty
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');
const { getMysqlConnectionOptions } = require('../lib/mysqlConnectionOptions');
const { applyFirstBoot, readSeedFile, SEED_FILE } = require('./lib/contentSeed');

async function main() {
  const execute = process.argv.includes('--execute');
  const force = process.argv.includes('--force');
  const opts = getMysqlConnectionOptions();
  const seed = readSeedFile();
  const db = await mysql.createConnection(opts);
  try {
    const result = await applyFirstBoot(db, seed, {
      execute,
      force,
      host: opts.host,
    });
    console.log(`Seed file: ${SEED_FILE}`);
    console.log(JSON.stringify(result.plan, null, 2));
    if (result.dryRun) {
      console.log('Dry-run only. Pass --execute to insert into empty tables.');
      return;
    }
    console.log(result.message || (result.wrote ? 'First-boot inserts completed.' : 'No writes.'));
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
