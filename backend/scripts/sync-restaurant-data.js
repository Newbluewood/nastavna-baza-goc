require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getMysqlConnectionOptions } = require('../lib/mysqlConnectionOptions');

const DOCS_DIR = path.join(__dirname, '../docs');

function readJsonSafe(filename) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DOCS_DIR, filename), 'utf8'));
  } catch (err) {
    console.warn(`Could not read ${filename}`);
    return null;
  }
}

async function syncRestaurantData() {
  const dbOpts = getMysqlConnectionOptions();
  const db = await mysql.createConnection(dbOpts);
  
  console.log('Connected to DB for restaurant sync');

  // Load the menu data
  const meniDoc = readJsonSafe('piramida-meni.json');
  if (!meniDoc || !meniDoc.meni) {
    console.error('No menu data found in piramida-meni.json');
    await db.end();
    return;
  }

  // Ensure 'Restoran Piramida' exists as a separate entity
  let [rows] = await db.query("SELECT id FROM attractions WHERE name = 'Restoran Piramida'");
  let attractionId;

  if (rows.length > 0) {
    attractionId = rows[0].id;
    console.log(`Found existing 'Restoran Piramida' with ID: ${attractionId}`);
  } else {
    const [res] = await db.query("INSERT INTO attractions (type, name, description, distance_km, distance_minutes) VALUES ('restaurant', 'Restoran Piramida', 'Glavni restoran u sklopu hotela Piramida, nudi bogat izbor tradicionalnih jela.', 0.2, 5)");
    attractionId = res.insertId;
    console.log(`Created new 'Restoran Piramida' with ID: ${attractionId}`);
  }

  // Clear existing items to avoid duplicates during sync
  await db.query("DELETE FROM restaurant_menu_items WHERE attraction_id = ?", [attractionId]);

  // Insert items from JSON
  let count = 0;
  for (const [category, items] of Object.entries(meniDoc.meni)) {
    for (const item of items) {
      const name = item.ime;
      const desc = (item.namernice || []).join(', ');
      const price = item.cena;
      
      await db.query(`
        INSERT INTO restaurant_menu_items (attraction_id, lang, category, name, description, price, is_available, sort_order)
        VALUES (?, 'sr', ?, ?, ?, ?, 1, ?)
      `, [attractionId, category, name, desc, price, count + 1]);
      count++;
    }
  }

  console.log(`Successfully synced ${count} menu items to restaurant ID ${attractionId}.`);
  await db.end();
}

syncRestaurantData().catch(console.error);
