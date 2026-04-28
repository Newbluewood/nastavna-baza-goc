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

async function migrate() {
  const dbOpts = getMysqlConnectionOptions();
  const db = await mysql.createConnection(dbOpts);
  
  console.log('Connected to DB for migration');

  // Migrate Piramida Meni -> restaurant_menu_items
  const meniDoc = readJsonSafe('piramida-meni.json');
  if (meniDoc && meniDoc.meni) {
    // Check if attraction 'Restoran Piramida' exists
    const [existing] = await db.query("SELECT id FROM attractions WHERE name = 'Restoran Piramida'");
    let attractionId;
    if (existing.length > 0) {
      attractionId = existing[0].id;
    } else {
      const [res] = await db.query("INSERT INTO attractions (type, name, description) VALUES ('restoran', 'Restoran Piramida', 'Restoran u sklopu Hotela Piramida')");
      attractionId = res.insertId;
    }
    
    // clear existing items just in case
    await db.query("DELETE FROM restaurant_menu_items WHERE attraction_id = ?", [attractionId]);

    // insert items
    for (const [category, items] of Object.entries(meniDoc.meni)) {
      for (const item of items) {
        const name = item.ime;
        const desc = (item.namernice || []).join(', ');
        const price = item.cena;
        
        await db.query(`
          INSERT INTO restaurant_menu_items (attraction_id, lang, category, name, description, price)
          VALUES (?, 'sr', ?, ?, ?, ?)
        `, [attractionId, category, name, desc, price]);
      }
    }
    console.log('Migrated piramida-meni.json to restaurant_menu_items');
  }

  // Migrate goc-gvozdac-okolina -> attractions
  const okolinaDoc = readJsonSafe('goc-gvozdac-okolina.json');
  if (okolinaDoc && okolinaDoc.atrakcije) {
    for (const a of okolinaDoc.atrakcije) {
      const type = a.kategorija || 'Priroda';
      
      const [existing] = await db.query("SELECT id FROM attractions WHERE name = ?", [a.ime]);
      if (existing.length === 0) {
        await db.query(`
          INSERT INTO attractions (type, name, description)
          VALUES (?, ?, ?)
        `, [type, a.ime, a.opis]);
      }
    }
    console.log('Migrated goc-gvozdac-okolina.json to attractions');
  }

  // Helper to migrate to pages
  async function migrateToPages(filename, slug, title) {
    const doc = readJsonSafe(filename);
    if (doc) {
      const content = JSON.stringify(doc);
      // check if exists
      const [ex] = await db.query("SELECT id FROM pages WHERE slug = ?", [slug]);
      if (ex.length > 0) {
        await db.query("UPDATE pages SET content = ? WHERE slug = ?", [content, slug]);
      } else {
        await db.query("INSERT INTO pages (slug, title, content) VALUES (?, ?, ?)", [slug, title, content]);
      }
      console.log(`Migrated ${filename} to pages (slug: ${slug})`);
    }
  }

  await migrateToPages('faq.json', 'faq', 'Najčešća pitanja');
  await migrateToPages('campus.json', 'campus', 'Studentski kampus');
  await migrateToPages('events.json', 'events', 'Događaji i dešavanja');
  await migrateToPages('contacts.json', 'contacts', 'Kontakti');
  await migrateToPages('prices.json', 'prices', 'Cenovnik');
  await migrateToPages('labs.json', 'labs', 'Laboratorije');
  await migrateToPages('wooddryer.json', 'wooddryer', 'Sušara za drvo');
  await migrateToPages('sawmill.json', 'sawmill', 'Pilana');
  await migrateToPages('announcements.json', 'announcements', 'Obaveštenja');
  
  // news.json can go to news table
  const newsDoc = readJsonSafe('news.json');
  if (newsDoc && newsDoc.news) {
    for (const n of newsDoc.news) {
      const [ex] = await db.query("SELECT id FROM news WHERE title = ?", [n.title]);
      if (ex.length === 0) {
        await db.query("INSERT INTO news (title, excerpt, content, created_at) VALUES (?, ?, ?, ?)", 
          [n.title, n.excerpt, n.content, n.date ? new Date(n.date) : new Date()]);
      }
    }
    console.log('Migrated news.json to news table');
  }

  console.log('Migration complete.');
  await db.end();
}

migrate().catch(console.error);
