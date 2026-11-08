/**
 * Fill room_translations.meal_info (en) where missing.
 * Dry-run by default. Pass --execute to write.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const EXECUTE = process.argv.includes('--execute');
const MEAL_EN =
  'Breakfast: 590, Lunch: 1080, Dinner: 880. Tourist tax 160 RSD not included.';

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    ssl: process.env.DB_SSL === 'REQUIRED' ? { rejectUnauthorized: false } : undefined,
  });

  const [rows] = await c.query(`
    SELECT r.id, r.meal_info AS meal_sr, rt.id AS tr_id, rt.meal_info AS meal_en
    FROM rooms r
    LEFT JOIN room_translations rt ON rt.entity_id = r.id AND rt.lang = 'en'
    WHERE r.meal_info IS NOT NULL AND TRIM(r.meal_info) <> ''
      AND (rt.meal_info IS NULL OR TRIM(rt.meal_info) = '')
  `);

  console.log(`${EXECUTE ? 'UPDATE' : 'WOULD UPDATE'} ${rows.length} rooms`);
  for (const row of rows) {
    console.log(`  room #${row.id}`);
    if (!EXECUTE) continue;
    if (row.tr_id) {
      await c.query('UPDATE room_translations SET meal_info = ? WHERE id = ?', [MEAL_EN, row.tr_id]);
    } else {
      await c.query(
        'INSERT INTO room_translations (entity_id, lang, meal_info) VALUES (?, ?, ?)',
        [row.id, 'en', MEAL_EN]
      );
    }
  }

  await c.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
