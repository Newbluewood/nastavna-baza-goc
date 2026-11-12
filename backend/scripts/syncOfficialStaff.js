/**
 * Replace CMS staff with official roster (backend/data/officialStaff.js).
 *
 *   node scripts/syncOfficialStaff.js
 *   node scripts/syncOfficialStaff.js --execute
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { getMysqlConnectionOptions } = require('../lib/mysqlConnectionOptions');
const OFFICIAL_STAFF = require('../data/officialStaff');

const EXECUTE = process.argv.includes('--execute');
const PLACEHOLDER = '/placeholder-staff.svg';

async function run() {
  const conn = await mysql.createConnection(getMysqlConnectionOptions());
  console.log(EXECUTE ? 'MODE: execute' : 'MODE: dry-run');
  console.log(`Roster size: ${OFFICIAL_STAFF.length}`);

  try {
    if (!EXECUTE) {
      OFFICIAL_STAFF.forEach(([name, role], i) => console.log(`${i + 1}. ${name} — ${role}`));
      console.log('Re-run with --execute to write to DB.');
      return;
    }

    // TRUNCATE resets AUTO_INCREMENT so IDs restart at 1..N (no FKs into staff).
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE staff_translations');
    await conn.query('TRUNCATE TABLE staff');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    for (const [full_name, role, role_en, contact_email] of OFFICIAL_STAFF) {
      const [result] = await conn.query(
        'INSERT INTO staff (full_name, role, contact_email, photo_url) VALUES (?, ?, ?, ?)',
        [full_name, role, contact_email, PLACEHOLDER]
      );
      if (role_en) {
        await conn.query(
          'INSERT INTO staff_translations (entity_id, lang, role) VALUES (?, ?, ?)',
          [result.insertId, 'en', role_en]
        );
      }
      console.log(`INSERTED: ${full_name}`);
    }

    const [count] = await conn.query('SELECT COUNT(*) AS c FROM staff');
    const nextId = Number(count[0].c) + 1;
    await conn.query(`ALTER TABLE staff AUTO_INCREMENT = ${nextId}`);
    const [ai] = await conn.query("SHOW TABLE STATUS LIKE 'staff'");
    console.log(`Done. staff rows: ${count[0].c}; next AUTO_INCREMENT=${ai[0].Auto_increment}`);
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
