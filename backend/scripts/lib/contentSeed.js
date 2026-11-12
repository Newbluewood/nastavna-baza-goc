'use strict';

const fs = require('fs');
const path = require('path');

const SEED_DIR = path.join(__dirname, '..', '..', 'data', 'seed');
const SEED_FILE = path.join(SEED_DIR, 'content-seed.json');

function ensureSeedDir() {
  fs.mkdirSync(SEED_DIR, { recursive: true });
}

function readSeedFile(filePath = SEED_FILE) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function writeSeedFile(payload, filePath = SEED_FILE) {
  ensureSeedDir();
  const body = {
    schemaVersion: 1,
    purpose: 'first-boot content seed (not a production backup)',
    exportedAt: payload.exportedAt || new Date().toISOString(),
    sourceHost: payload.sourceHost || null,
    themes: payload.themes || [],
    pages: payload.pages || [],
    news: payload.news || [],
    attractions: payload.attractions || [],
    menu: payload.menu || [],
  };
  fs.writeFileSync(filePath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return filePath;
}

async function exportContentFromDb(db, meta = {}) {
  const [themeRows] = await db.query(`
    SELECT t.slug, t.icon, t.hero_image, t.keywords, t.display_order,
      MAX(CASE WHEN tt.lang = 'sr' THEN tt.name END) AS name_sr,
      MAX(CASE WHEN tt.lang = 'sr' THEN tt.article END) AS article_sr,
      MAX(CASE WHEN tt.lang = 'en' THEN tt.name END) AS name_en,
      MAX(CASE WHEN tt.lang = 'en' THEN tt.article END) AS article_en
    FROM themes t
    LEFT JOIN theme_translations tt ON t.id = tt.entity_id
    GROUP BY t.id
    ORDER BY t.display_order ASC, t.id ASC
  `);

  const [pageRows] = await db.query(`
    SELECT p.slug, p.title, p.content, p.hero_image,
      pt.title AS title_en, pt.content AS content_en
    FROM pages p
    LEFT JOIN page_translations pt ON p.id = pt.entity_id AND pt.lang = 'en'
    ORDER BY p.id ASC
  `);

  const [newsRows] = await db.query(`
    SELECT n.slug, n.title, n.excerpt, n.content, n.cover_image, n.likes, n.created_at,
      nt.title AS title_en, nt.excerpt AS excerpt_en, nt.content AS content_en
    FROM news n
    LEFT JOIN news_translations nt ON n.id = nt.entity_id AND nt.lang = 'en'
    ORDER BY n.created_at DESC, n.id DESC
  `);

  const [attractionRows] = await db.query(`
    SELECT a.id, a.type, a.name, a.description, a.distance_km, a.distance_minutes,
      a.family_friendly, a.weather_tags, a.season_tags, a.suitable_for, a.cover_image, a.is_active,
      at_en.name AS name_en, at_en.description AS description_en
    FROM attractions a
    LEFT JOIN attraction_translations at_en ON a.id = at_en.entity_id AND at_en.lang = 'en'
    ORDER BY a.id ASC
  `);

  const [menuRows] = await db.query(`
    SELECT a.name AS attraction_name, m.lang, m.category, m.name, m.description, m.price,
      m.is_available, m.sort_order
    FROM restaurant_menu_items m
    JOIN attractions a ON a.id = m.attraction_id
    ORDER BY a.id ASC, m.lang ASC, m.sort_order ASC, m.id ASC
  `);

  return writeSeedFile({
    exportedAt: new Date().toISOString(),
    sourceHost: meta.sourceHost || null,
    themes: themeRows.map((t) => ({
      slug: t.slug,
      icon: t.icon || null,
      hero_image: t.hero_image || null,
      keywords: safeJson(t.keywords),
      display_order: t.display_order ?? 0,
      name_sr: t.name_sr || '',
      article_sr: t.article_sr || '',
      name_en: t.name_en || '',
      article_en: t.article_en || '',
    })),
    pages: pageRows.map((p) => ({
      slug: p.slug,
      title: p.title || '',
      content: p.content || null,
      hero_image: p.hero_image || null,
      title_en: p.title_en || '',
      content_en: p.content_en || null,
    })),
    news: newsRows.map((n) => ({
      slug: n.slug,
      title: n.title || '',
      excerpt: n.excerpt || null,
      content: n.content || null,
      cover_image: n.cover_image || null,
      likes: n.likes || 0,
      created_at: n.created_at ? new Date(n.created_at).toISOString() : null,
      title_en: n.title_en || '',
      excerpt_en: n.excerpt_en || null,
      content_en: n.content_en || null,
    })),
    attractions: attractionRows.map((a) => ({
      type: a.type,
      name: a.name,
      description: a.description || null,
      distance_km: a.distance_km,
      distance_minutes: a.distance_minutes,
      family_friendly: a.family_friendly,
      weather_tags: safeJson(a.weather_tags),
      season_tags: safeJson(a.season_tags),
      suitable_for: safeJson(a.suitable_for),
      cover_image: a.cover_image || null,
      is_active: a.is_active,
      name_en: a.name_en || '',
      description_en: a.description_en || null,
    })),
    menu: menuRows.map((m) => ({
      attraction_name: m.attraction_name,
      lang: m.lang || 'sr',
      category: m.category || null,
      name: m.name,
      description: m.description || null,
      price: m.price,
      is_available: m.is_available,
      sort_order: m.sort_order ?? 0,
    })),
  });
}

function safeJson(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

async function countRows(db, table) {
  const [rows] = await db.query(`SELECT COUNT(*) AS c FROM ${table}`);
  return Number(rows[0]?.c || 0);
}

/**
 * Plan first-boot actions. Never mutates DB.
 * Populated tables are skipped so a live CMS is not overwritten.
 */
async function planFirstBoot(db, seed = readSeedFile()) {
  const themesCount = await countRows(db, 'themes');
  const pagesCount = await countRows(db, 'pages');
  const newsCount = await countRows(db, 'news');
  const attractionsCount = await countRows(db, 'attractions');
  const menuCount = await countRows(db, 'restaurant_menu_items');

  return {
    themes: {
      existing: themesCount,
      seed: (seed.themes || []).length,
      action: themesCount > 0 ? 'skip' : 'insert',
    },
    pages: {
      existing: pagesCount,
      seed: (seed.pages || []).length,
      action: pagesCount > 0 ? 'skip' : 'insert',
    },
    news: {
      existing: newsCount,
      seed: (seed.news || []).length,
      action: newsCount > 0 ? 'skip' : 'insert',
    },
    attractions: {
      existing: attractionsCount,
      seed: (seed.attractions || []).length,
      action: attractionsCount > 0 ? 'skip' : 'insert',
    },
    menu: {
      existing: menuCount,
      seed: (seed.menu || []).length,
      action: menuCount > 0 ? 'skip' : 'insert',
    },
  };
}

function isProductionLikeHost(host) {
  return /\.aivencloud\.com$/i.test(String(host || ''));
}

async function applyFirstBoot(db, seed, { execute = false, force = false, host = '' } = {}) {
  const plan = await planFirstBoot(db, seed);
  const willWrite = Object.values(plan).some((p) => p.action === 'insert');

  if (!execute) {
    return { dryRun: true, plan, wrote: false };
  }

  if (force) {
    throw new Error('Refusing --force: first-boot must not overwrite an existing CMS. Export a new seed instead.');
  }

  if (!willWrite) {
    return { dryRun: false, plan, wrote: false, message: 'All content tables already have rows; nothing inserted.' };
  }

  if (isProductionLikeHost(host)) {
    const anyExisting = Object.values(plan).some((p) => p.existing > 0);
    if (anyExisting) {
      throw new Error('Refusing first-boot write on production-like host while content tables are not empty.');
    }
  }

  if (plan.themes.action === 'insert') {
    for (const t of seed.themes || []) {
      const [res] = await db.query(
        'INSERT INTO themes (slug, icon, hero_image, keywords, display_order) VALUES (?, ?, ?, ?, ?)',
        [t.slug, t.icon || null, t.hero_image || null, t.keywords ? JSON.stringify(t.keywords) : null, t.display_order ?? 0]
      );
      const id = res.insertId;
      if (t.name_sr || t.article_sr) {
        await db.query(
          'INSERT INTO theme_translations (entity_id, lang, name, article) VALUES (?, ?, ?, ?)',
          [id, 'sr', t.name_sr || null, t.article_sr || null]
        );
      }
      if (t.name_en || t.article_en) {
        await db.query(
          'INSERT INTO theme_translations (entity_id, lang, name, article) VALUES (?, ?, ?, ?)',
          [id, 'en', t.name_en || null, t.article_en || null]
        );
      }
    }
  }

  if (plan.pages.action === 'insert') {
    for (const p of seed.pages || []) {
      const [res] = await db.query(
        'INSERT INTO pages (slug, title, content, hero_image) VALUES (?, ?, ?, ?)',
        [p.slug, p.title || '', p.content || null, p.hero_image || null]
      );
      if (p.title_en || p.content_en) {
        await db.query(
          'INSERT INTO page_translations (entity_id, lang, title, content) VALUES (?, ?, ?, ?)',
          [res.insertId, 'en', p.title_en || null, p.content_en || null]
        );
      }
    }
  }

  if (plan.news.action === 'insert') {
    for (const n of seed.news || []) {
      const [res] = await db.query(
        'INSERT INTO news (slug, title, excerpt, content, cover_image, likes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          n.slug,
          n.title || '',
          n.excerpt || null,
          n.content || null,
          n.cover_image || '/placeholder.jpg',
          n.likes || 0,
          n.created_at ? new Date(n.created_at) : new Date(),
        ]
      );
      if (n.title_en || n.excerpt_en || n.content_en) {
        await db.query(
          'INSERT INTO news_translations (entity_id, lang, title, excerpt, content) VALUES (?, ?, ?, ?, ?)',
          [res.insertId, 'en', n.title_en || null, n.excerpt_en || null, n.content_en || null]
        );
      }
    }
  }

  if (plan.attractions.action === 'insert') {
    for (const a of seed.attractions || []) {
      const [res] = await db.query(
        `INSERT INTO attractions
          (type, name, description, distance_km, distance_minutes, family_friendly, weather_tags, season_tags, suitable_for, cover_image, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.type || 'nature',
          a.name,
          a.description || null,
          a.distance_km ?? null,
          a.distance_minutes ?? null,
          a.family_friendly ?? true,
          a.weather_tags ? JSON.stringify(a.weather_tags) : null,
          a.season_tags ? JSON.stringify(a.season_tags) : null,
          a.suitable_for ? JSON.stringify(a.suitable_for) : null,
          a.cover_image || null,
          a.is_active ?? true,
        ]
      );
      await db.query(
        'INSERT INTO attraction_translations (entity_id, lang, name, description) VALUES (?, ?, ?, ?)',
        [res.insertId, 'sr', a.name, a.description || null]
      );
      if (a.name_en || a.description_en) {
        await db.query(
          'INSERT INTO attraction_translations (entity_id, lang, name, description) VALUES (?, ?, ?, ?)',
          [res.insertId, 'en', a.name_en || a.name, a.description_en || null]
        );
      }
    }
  }

  if (plan.menu.action === 'insert') {
    for (const m of seed.menu || []) {
      const [attrRows] = await db.query('SELECT id FROM attractions WHERE name = ? LIMIT 1', [m.attraction_name]);
      if (!attrRows.length) {
        console.warn(`[seed] skip menu item "${m.name}" — attraction "${m.attraction_name}" missing`);
        continue;
      }
      await db.query(
        `INSERT INTO restaurant_menu_items
          (attraction_id, lang, category, name, description, price, is_available, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          attrRows[0].id,
          m.lang || 'sr',
          m.category || null,
          m.name,
          m.description || null,
          m.price ?? null,
          m.is_available ?? true,
          m.sort_order ?? 0,
        ]
      );
    }
  }

  return { dryRun: false, plan, wrote: true };
}

module.exports = {
  SEED_DIR,
  SEED_FILE,
  readSeedFile,
  writeSeedFile,
  exportContentFromDb,
  planFirstBoot,
  applyFirstBoot,
  isProductionLikeHost,
  countRows,
};
