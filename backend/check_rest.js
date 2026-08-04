const mysql = require('mysql2/promise');
const fs = require('fs');
const { getMysqlConnectionOptions } = require('./lib/mysqlConnectionOptions');

async function addKeywords() {
  const conn = await mysql.createConnection(getMysqlConnectionOptions());

  // 1. Dodaj keywords kolonu u themes tabelu ako ne postoji
  const [cols] = await conn.query(`
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'themes' AND COLUMN_NAME = 'keywords'
  `);
  
  if (cols.length === 0) {
    await conn.query("ALTER TABLE themes ADD COLUMN keywords JSON NULL");
    console.log('✔ Kolona keywords dodata u tabelu themes');
  } else {
    console.log('SKIP: kolona keywords već postoji');
  }

  // 2. Učitaj podatke iz goc-themes.json
  const themesData = JSON.parse(fs.readFileSync('./data/goc-themes.json', 'utf-8'));

  // 3. Ažuriraj svaku temu sa ključnim rečima
  for (const t of themesData.themes) {
    const keywords = t.keywords || [];
    const [res] = await conn.query(
      "UPDATE themes SET keywords = ? WHERE slug = ?",
      [JSON.stringify(keywords), t.id]
    );
    if (res.affectedRows > 0) {
      console.log(`✔ [${t.id}] keywords: ${JSON.stringify(keywords)}`);
    } else {
      console.log(`! [${t.id}] tema nije pronađena u bazi`);
    }
  }

  // 4. Verifikacija
  console.log('\n=== VERIFIKACIJA ===');
  const [rows] = await conn.query("SELECT slug, keywords FROM themes");
  rows.forEach(r => console.log(`[${r.slug}]:`, r.keywords));

  await conn.end();
  process.exit(0);
}

addKeywords().catch(e => { console.error(e); process.exit(1); });
