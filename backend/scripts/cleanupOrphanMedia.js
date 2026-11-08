/**
 * Delete orphan local images + placeholder media_gallery rows.
 * Dry-run by default. Pass --execute to apply.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const EXECUTE = process.argv.includes('--execute');
const ROOT = path.join(__dirname, '..', '..');

const DELETE_FILES = [
  // unused restaurant stock (DB uses Unsplash)
  'backend/public/images/restaurants/pecenjara.png',
  'backend/public/images/restaurants/piramida.png',
  'frontend/public/images/restaurants/pecenjara.png',
  'frontend/public/images/restaurants/piramida.png',
  // unused FE chrome
  'frontend/public/buble-chat.png',
  'frontend/public/icon.png',
  'frontend/public/logo-sf.svg',
  // FE copies of API-served /images/* (public pages/themes always via getImageUrl → backend)
  'frontend/public/images/pages/education.png',
  'frontend/public/images/pages/faq.png',
  'frontend/public/images/pages/istrazi.png',
  'frontend/public/images/pages/research.png',
  'frontend/public/images/pages/restoran.png',
  'frontend/public/images/pages/vesti.png',
  'frontend/public/images/themes/accommodation.png',
  'frontend/public/images/themes/flora.png',
  'frontend/public/images/themes/hunting.png',
  'frontend/public/images/themes/landmarks.png',
  'frontend/public/images/themes/staff.png',
  'frontend/public/images/themes/trails.png',
];

const KEEP_NOTE = [
  'frontend/public/themes/* — theme icons (Home/Istrazi bez getImageUrl)',
  'frontend/public/placeholder.jpg — FE fallback',
  'frontend/public/explore-hero.png, news-hero.png — FE fallbackovi',
  'backend/public/images/** — API static (DB hero/page/theme paths)',
  'backend/public/themes/** — DB icon paths ako se traže sa API hosta',
];

function rmEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) rmEmptyDirs(full);
  }
  if (fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
    console.log(`${EXECUTE ? 'RMDIR' : 'WOULD RMDIR'} ${dir}`);
  }
}

(async () => {
  console.log(EXECUTE ? 'EXECUTE mode' : 'DRY-RUN (pass --execute to apply)');
  console.log('Keep:', KEEP_NOTE);

  const deleted = [];
  const missing = [];
  for (const rel of DELETE_FILES) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    const size = fs.statSync(abs).size;
    console.log(`${EXECUTE ? 'DELETE' : 'WOULD DELETE'} ${rel} (${Math.round(size / 1024)} KB)`);
    if (EXECUTE) {
      fs.unlinkSync(abs);
      deleted.push(rel);
    }
  }

  rmEmptyDirs(path.join(ROOT, 'frontend', 'public', 'images'));
  rmEmptyDirs(path.join(ROOT, 'backend', 'public', 'images', 'restaurants'));

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    ssl: process.env.DB_SSL === 'REQUIRED' ? { rejectUnauthorized: false } : undefined,
  });

  const [rows] = await conn.query(
    "SELECT id, entity_type, entity_id, image_url FROM media_gallery WHERE image_url IN ('/placeholder.jpg','placeholder.jpg') OR image_url LIKE '%/placeholder.jpg'"
  );
  console.log(`media_gallery placeholder rows: ${rows.length}`);
  for (const r of rows) {
    console.log(`  #${r.id} ${r.entity_type}:${r.entity_id} → ${r.image_url}`);
  }

  if (EXECUTE && rows.length) {
    const [result] = await conn.query(
      "DELETE FROM media_gallery WHERE image_url IN ('/placeholder.jpg','placeholder.jpg') OR image_url LIKE '%/placeholder.jpg'"
    );
    console.log(`DELETED media_gallery rows: ${result.affectedRows}`);
  } else if (!EXECUTE) {
    console.log(`WOULD DELETE media_gallery rows: ${rows.length}`);
  }

  await conn.end();
  console.log(JSON.stringify({ missing, deletedCount: deleted.length, placeholderRows: rows.length }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
