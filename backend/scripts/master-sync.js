require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getMysqlConnectionOptions } = require('../lib/mysqlConnectionOptions');

const DOCS_DIR = path.join(__dirname, '../docs');
const DATA_DIR = path.join(__dirname, '../data');

function readJsonSafe(dir, filename) {
  try {
    const p = path.join(dir, filename);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    console.warn(`Could not read ${filename}: ${err.message}`);
    return null;
  }
}

async function masterSync() {
  const dbOpts = getMysqlConnectionOptions();
  const db = await mysql.createConnection(dbOpts);
  console.log('Connected to AWS RDS for Master Sync');

  // --- 1. SYNC THEMES ---
  console.log('Syncing Themes...');
  const themesDoc = readJsonSafe(DATA_DIR, 'goc-themes.json');
  if (themesDoc && themesDoc.themes) {
    for (const t of themesDoc.themes) {
      // Upsert main theme
      await db.query(`
        INSERT INTO themes (slug, icon, hero_image) 
        VALUES (?, ?, ?) 
        ON DUPLICATE KEY UPDATE icon=VALUES(icon), hero_image=VALUES(hero_image)
      `, [t.id, t.icon, t.hero_image]);
      
      const [themeRows] = await db.query("SELECT id FROM themes WHERE slug = ?", [t.id]);
      const themeId = themeRows[0].id;

      // Upsert translations
      await db.query(`
        INSERT INTO theme_translations (entity_id, lang, name, article)
        VALUES (?, 'sr', ?, ?), (?, 'en', ?, ?)
        ON DUPLICATE KEY UPDATE name=VALUES(name), article=VALUES(article)
      `, [themeId, t.name, t.article_sr, themeId, t.name, t.article_en]);
    }
  }

  // --- 2. SYNC ATTRACTIONS ---
  console.log('Syncing Attractions...');
  const attrDoc = readJsonSafe(DOCS_DIR, 'atractions.json');
  const envDoc = readJsonSafe(DOCS_DIR, 'goc-gvozdac-okolina.json');
  
  const allAttractions = [];
  if (attrDoc && attrDoc.attractions) allAttractions.push(...attrDoc.attractions);
  if (envDoc && envDoc.atrakcije) {
      // Map 'atrakcije' fields to 'attractions' schema
      const mapped = envDoc.atrakcije.map(a => ({
          name: a.ime,
          type: a.kategorija?.[0] || 'nature',
          description: a.opis,
          distance_km: a.udaljenost_km || 0
      }));
      allAttractions.push(...mapped);
  }

  for (const a of allAttractions) {
      const slug = a.name.toLowerCase().replace(/ /g, '-');
      await db.query(`
        INSERT INTO attractions (name, type, description, distance_km)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE description=VALUES(description), distance_km=VALUES(distance_km)
      `, [a.name, a.type || 'nature', a.description, a.distance_km || 0]);

      const [attrRows] = await db.query("SELECT id FROM attractions WHERE name = ?", [a.name]);
      const attrId = attrRows[0].id;

      await db.query(`
        INSERT INTO attraction_translations (entity_id, lang, name, description)
        VALUES (?, 'sr', ?, ?), (?, 'en', ?, ?)
        ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description)
      `, [attrId, a.name, a.description, attrId, a.name, a.description]);
  }

  // --- 3. SYNC RESTAURANT MENU (Piramida) ---
  console.log('Syncing Restaurant Menu (Piramida)...');
  const meniDoc = readJsonSafe(DOCS_DIR, 'piramida-meni.json');
  if (meniDoc && meniDoc.meni) {
      const [piraRows] = await db.query("SELECT id FROM attractions WHERE name = 'Restoran Piramida'");
      if (piraRows.length > 0) {
          const restId = piraRows[0].id;
          // Clean existing to avoid messy dupes for this specific sync
          await db.query("DELETE FROM restaurant_menu_items WHERE attraction_id = ?", [restId]);
          
          for (const [cat, items] of Object.entries(meniDoc.meni)) {
              for (const item of items) {
                  const [res] = await db.query(`
                    INSERT INTO restaurant_menu_items (attraction_id, name, price, category)
                    VALUES (?, ?, ?, ?)
                  `, [restId, item.ime, item.cena, cat]);
                  
                  const itemId = res.insertId;
                  const desc = (item.namernice || []).join(', ');
                  
                  await db.query(`
                    INSERT INTO restaurant_menu_item_translations (entity_id, lang, name, description, category)
                    VALUES (?, 'sr', ?, ?, ?), (?, 'en', ?, ?, ?)
                  `, [itemId, item.ime, desc, cat, itemId, item.ime, desc, cat]);
              }
          }
      }
  }

  async function syncPage(slug, titleSr, titleEn, contentSr, contentEn) {
    await db.query(`
      INSERT INTO pages (slug, title, content) 
      VALUES (?, ?, ?) 
      ON DUPLICATE KEY UPDATE title=VALUES(title), content=VALUES(content)
    `, [slug, titleSr, contentSr]);
    
    const [pRows] = await db.query("SELECT id FROM pages WHERE slug = ?", [slug]);
    const pageId = pRows[0].id;
    
    await db.query(`
      INSERT INTO page_translations (entity_id, lang, title, content)
      VALUES (?, 'sr', ?, ?), (?, 'en', ?, ?)
      ON DUPLICATE KEY UPDATE title=VALUES(title), content=VALUES(content)
    `, [pageId, titleSr, contentSr, pageId, titleEn, contentEn]);
  }

  // --- 4. SYNC NEWS ---
  console.log('Syncing News...');
  const newsDoc = readJsonSafe(DOCS_DIR, 'news.json');
  if (newsDoc && newsDoc.news) {
      for (const n of newsDoc.news) {
          const slug = n.title.toLowerCase().replace(/ /g, '-').substring(0, 50);
          await db.query(`
            INSERT INTO news (title, excerpt, content, slug, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE excerpt=VALUES(excerpt), content=VALUES(content)
          `, [n.title, n.excerpt, n.content, slug, n.date || new Date()]);

          const [nRows] = await db.query("SELECT id FROM news WHERE title = ?", [n.title]);
          const newsId = nRows[0].id;

          await db.query(`
            INSERT INTO news_translations (entity_id, lang, title, excerpt, content)
            VALUES (?, 'sr', ?, ?, ?), (?, 'en', ?, ?, ?)
            ON DUPLICATE KEY UPDATE title=VALUES(title), excerpt=VALUES(excerpt), content=VALUES(content)
          `, [newsId, n.title, n.excerpt, n.content, newsId, n.title, n.excerpt, n.content]);
      }
  }

  // --- 5. SYNC PAGES ---
  console.log('Syncing Pages (FAQ, Prices, Education, Research)...');
  
  const faqDoc = readJsonSafe(DOCS_DIR, 'faq.json');
  if (faqDoc && faqDoc.faq) {
      const content = faqDoc.faq.map(f => `### ${f.pitanje}\n${f.odgovor}`).join('\n\n');
      await syncPage('faq', 'Česta pitanja', 'FAQ', content, content);
  }

  const pricesDoc = readJsonSafe(DOCS_DIR, 'prices.json');
  if (pricesDoc && pricesDoc.cene) {
      const content = `### Cenovnik usluga\n\n` + pricesDoc.cene.map(p => `- **${p.stavka}**: ${p.iznos}`).join('\n');
      await syncPage('cenovnik', 'Cenovnik', 'Price List', content, content);
  }

  const campusDoc = readJsonSafe(DOCS_DIR, 'campus.json');
  const eduContent = `### Nastavna baza Gvozdac\nCentar za edukaciju studenata Šumarskog fakulteta, istraživanja i praktične obuke u prirodi. Pruža sadržaje za decu i omladinu.\n\n### Studentski kampus Goč\nKampus sa kapacitetom za 100 studenata, učionice, laboratorije i sportski tereni.`;
  await syncPage('edukacija', 'Edukacija', 'Education', eduContent, eduContent);

  const resContent = `### Laboratorije\n- **Laboratorija za šumsku ekologiju**: Opremljena za istraživanja iz oblasti šumske ekologije i biodiverziteta.\n- **Laboratorija za preradu drveta**: Savremena laboratorija za testiranje i razvoj novih tehnologija u preradi drveta.\n\n### Industrijski objekti\n- **Pilana Goč**: Pilana sa modernim mašinama za obradu drveta, podržava praktičnu nastavu i istraživanja.\n- **Sušara za drvo Goč**: Industrijska sušara za drvo kapaciteta 20m3, koristi ekološki prihvatljive metode sušenja.`;
  await syncPage('istrazivanje', 'Naučno-istraživački rad', 'Research', resContent, resContent);

  console.log('Master Sync Completed Successfully!');
  await db.end();
}

masterSync().catch(console.error);
