require('dotenv').config()
const db = require('../db')

async function run() {
  const [rows] = await db.query(`
    SELECT n.id, n.label_sr, n.label_en, pt.title AS title_en
    FROM nav_items n
    LEFT JOIN pages p ON p.id = n.page_id
    LEFT JOIN page_translations pt ON pt.entity_id = p.id AND pt.lang = 'en'
    WHERE n.page_id IS NOT NULL
      AND (n.label_en IS NULL OR n.label_en = '')
  `)

  for (const row of rows) {
    const en = row.title_en || null
    if (!en) {
      console.log(`SKIP id=${row.id} (${row.label_sr}) — no page EN title`)
      continue
    }
    await db.query('UPDATE nav_items SET label_en = ? WHERE id = ?', [en, row.id])
    console.log(`UPDATED id=${row.id} → ${en}`)
  }
}

run()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => db.end())
