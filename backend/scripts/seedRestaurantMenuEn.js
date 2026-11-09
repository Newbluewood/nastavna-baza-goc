/**
 * Upsert English restaurant menu rows (paired by attraction_id + sort_order).
 * Dry-run by default. Pass --execute to write.
 *
 * Usage: node scripts/seedRestaurantMenuEn.js [--execute]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mysql = require('mysql2/promise')
const { getMysqlConnectionOptions } = require('../lib/mysqlConnectionOptions')

const EXECUTE = process.argv.includes('--execute')

const CATEGORY_EN = {
  'Предјела': 'Starters',
  'Супе и чорбе': 'Soups and stews',
  'Главна јела': 'Main courses',
  'Прилози': 'Side dishes',
  'Салате': 'Salads',
  'Посластице': 'Desserts',
  'Пића': 'Drinks',
  'Кафе': 'Coffee',
  'Сокови': 'Juices',
}

/** Keyed by Serbian dish name (exact match from DB). */
const ITEM_EN = {
  'Домаћа пршута и сир са Гоча': {
    name: 'Homemade Goč prosciutto and cheese',
    description: 'Prosciutto, cheese, flatbread.',
  },
  'Погача испод сача са кајмаком': {
    name: 'Sac-baked flatbread with kaymak',
    description: 'Flatbread, kaymak cream.',
  },
  'Телећа чорба': {
    name: 'Veal stew',
    description: 'Veal, vegetables, spices.',
  },
  'Супа од печурака': {
    name: 'Mushroom soup',
    description: 'Forest mushrooms, vegetables, spices.',
  },
  'Јагњетина испод сача': {
    name: 'Lamb under the sac',
    description: 'Lamb, potatoes, onion, spices.',
  },
  'Пастрмка са жара': {
    name: 'Grilled trout',
    description: 'Trout, lemon, spices.',
  },
  'Пилећи филе у сосу од печурака': {
    name: 'Chicken fillet in mushroom sauce',
    description: 'Chicken fillet, mushrooms, cream, spices.',
  },
  'Сарма са домаћим киселим купусом': {
    name: 'Sarma with homemade sauerkraut',
    description: 'Cabbage, minced meat, rice, spices.',
  },
  'Кромпир из рерне са зачинским биљем': {
    name: 'Roasted potatoes with herbs',
    description: 'Potatoes, rosemary, olive oil.',
  },
  'Домаћа проја': {
    name: 'Homemade cornbread (proja)',
    description: 'Cornmeal, cheese, eggs.',
  },
  'Кисело млеко': {
    name: 'Sour milk',
    description: 'Milk, fermented culture.',
  },
  'Шопска салата': {
    name: 'Shopska salad',
    description: 'Tomato, cucumber, pepper, cheese.',
  },
  'Купус салата': {
    name: 'Cabbage salad',
    description: 'Cabbage, vinegar, oil.',
  },
  'Сезонска мешана салата': {
    name: 'Seasonal mixed salad',
    description: 'Tomato, cucumber, lettuce, onion.',
  },
  'Пита са јабукама и орасима': {
    name: 'Apple and walnut pie',
    description: 'Apples, walnuts, cinnamon, pastry.',
  },
  'Штрудла са маком': {
    name: 'Poppy-seed strudel',
    description: 'Poppy seeds, flour, sugar.',
  },
  'Мед и ораси': {
    name: 'Honey and walnuts',
    description: 'Homemade honey, walnuts.',
  },
  'Домаћа ракија': {
    name: 'Homemade rakija',
    description: 'Plum, quince.',
  },
  'Вино из Жупе': {
    name: 'Wine from Župa',
    description: 'Grapes.',
  },
  'Планинска вода': {
    name: 'Mountain water',
    description: 'Spring water.',
  },
  'Домаћа кафа': {
    name: 'Turkish-style coffee',
    description: 'Ground coffee.',
  },
  'Еспресо': {
    name: 'Espresso',
    description: 'Espresso coffee.',
  },
  'Капућино': {
    name: 'Cappuccino',
    description: 'Espresso, milk, foam.',
  },
  'Сок од малине': {
    name: 'Raspberry juice',
    description: 'Raspberry, sugar, water.',
  },
  'Сок од купине': {
    name: 'Blackberry juice',
    description: 'Blackberry, sugar, water.',
  },
  'Сок од боровнице': {
    name: 'Blueberry juice',
    description: 'Blueberry, sugar, water.',
  },
}

async function upsertEn(conn, sr) {
  const tr = ITEM_EN[sr.name]
  if (!tr) {
    throw new Error(`Missing EN map for SR dish: ${sr.name}`)
  }
  const categoryEn = CATEGORY_EN[sr.category] || sr.category
  const [siblings] = await conn.query(
    `SELECT id FROM restaurant_menu_items
     WHERE attraction_id = ? AND lang = 'en' AND sort_order = ? AND id <> ?
     LIMIT 1`,
    [sr.attraction_id, sr.sort_order, sr.id]
  )

  if (siblings.length) {
    if (EXECUTE) {
      await conn.query(
        `UPDATE restaurant_menu_items
         SET category = ?, name = ?, description = ?, price = ?, is_available = ?, sort_order = ?
         WHERE id = ?`,
        [
          categoryEn,
          tr.name,
          tr.description,
          sr.price,
          sr.is_available,
          sr.sort_order,
          siblings[0].id,
        ]
      )
    }
    return { action: 'update', enId: siblings[0].id, name: tr.name, category: categoryEn }
  }

  if (EXECUTE) {
    const [result] = await conn.query(
      `INSERT INTO restaurant_menu_items
       (attraction_id, lang, category, name, description, price, is_available, sort_order)
       VALUES (?, 'en', ?, ?, ?, ?, ?, ?)`,
      [
        sr.attraction_id,
        categoryEn,
        tr.name,
        tr.description,
        sr.price,
        sr.is_available,
        sr.sort_order,
      ]
    )
    return { action: 'insert', enId: result.insertId, name: tr.name, category: categoryEn }
  }

  return { action: 'insert', enId: null, name: tr.name, category: categoryEn }
}

;(async () => {
  const conn = await mysql.createConnection(getMysqlConnectionOptions())
  const [srRows] = await conn.query(
    `SELECT id, attraction_id, category, name, description, price, is_available, sort_order
     FROM restaurant_menu_items
     WHERE lang = 'sr'
     ORDER BY attraction_id ASC, sort_order ASC, id ASC`
  )

  console.log(`${EXECUTE ? 'WRITE' : 'DRY-RUN'} — ${srRows.length} SR menu items`)
  const missing = srRows.filter((row) => !ITEM_EN[row.name]).map((row) => row.name)
  if (missing.length) {
    console.error('Missing translations for:', missing)
    process.exit(1)
  }

  for (const row of srRows) {
    const result = await upsertEn(conn, row)
    console.log(
      `  [#${row.id} sort=${row.sort_order}] ${row.name} → ${result.action} EN "${result.name}" (${result.category})`
    )
  }

  await conn.end()
  console.log(EXECUTE ? 'Done.' : 'Dry-run only. Re-run with --execute to write.')
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
