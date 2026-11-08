require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const ROOT = path.join(__dirname, '..', '..');
const BE = path.join(ROOT, 'backend', 'public');
const FE = path.join(ROOT, 'frontend', 'public');

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (/\.(jpe?g|png|webp|gif|svg|ico)$/i.test(e.name)) acc.push(full);
  }
  return acc;
}

function urlOf(abs, root) {
  return '/' + path.relative(root, abs).split(path.sep).join('/');
}

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    ssl: process.env.DB_SSL === 'REQUIRED' ? { rejectUnauthorized: false } : undefined,
  });

  const [themeCols] = await c.query('SHOW COLUMNS FROM themes');
  console.log('themes cols:', themeCols.map((x) => x.Field).join(', '));

  const [themes] = await c.query('SELECT id, slug, icon, hero_image FROM themes');
  console.log('themes:', JSON.stringify(themes, null, 2));

  const [pages] = await c.query('SELECT id, slug, hero_image FROM pages');
  console.log('pages:', JSON.stringify(pages, null, 2));

  const [staff] = await c.query('SELECT id, full_name, photo_url FROM staff');
  console.log('staff photos:', JSON.stringify(staff.map((s) => ({ id: s.id, photo_url: s.photo_url })), null, 2));

  const [rest] = await c.query('SELECT id, name, cover_image FROM restorani').catch(() => [[]]);
  if (rest.length) console.log('restorani:', JSON.stringify(rest, null, 2));

  const [mg] = await c.query('SELECT id, entity_type, entity_id, image_url FROM media_gallery');
  console.log('media_gallery:', JSON.stringify(mg, null, 2));

  const [rooms] = await c.query('SELECT id, name, cover_image FROM rooms WHERE cover_image IS NOT NULL LIMIT 5');
  console.log('sample room covers:', JSON.stringify(rooms, null, 2));

  const refs = new Set();
  const add = (v) => { if (v && String(v).trim()) refs.add(String(v).trim()); };
  for (const t of themes) { add(t.icon); add(t.hero_image); }
  for (const p of pages) add(p.hero_image);
  for (const s of staff) add(s.photo_url);
  for (const g of mg) add(g.image_url);

  // hard-coded FE fallbacks that are intentional assets
  const codeHardcoded = [
    '/placeholder.jpg',
    '/placeholder-staff.svg',
    '/placeholder-staff.png',
    '/explore-hero.png',
    '/news-hero.png',
    '/themes/flora.png',
    '/favicon.svg',
    '/favicon.ico',
    '/logo-sf.svg',
    '/logo.svg',
    '/icon.png',
    '/buble-chat.png',
  ];
  codeHardcoded.forEach(add);

  // grep-like: scan for /images/ and /themes/ in src
  const scanDirs = [path.join(ROOT, 'frontend', 'src'), path.join(ROOT, 'backend')];
  const re = /['"`](\/(?:images|themes|uploads)[^'"`]+?\.(?:png|jpe?g|webp|gif|svg))['"`]/gi;
  for (const dir of scanDirs) {
    const files = [];
    const w = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name === 'node_modules') continue;
        const f = path.join(d, e.name);
        if (e.isDirectory()) w(f);
        else if (/\.(js|vue|ts|css)$/.test(e.name)) files.push(f);
      }
    };
    w(dir);
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      let m;
      while ((m = re.exec(text))) add(m[1]);
    }
  }

  const beFiles = walk(BE).map((a) => ({ zone: 'backend/public', abs: a, url: urlOf(a, BE) }));
  const feFiles = walk(FE).map((a) => ({ zone: 'frontend/public', abs: a, url: urlOf(a, FE) }));

  const classify = (files) => {
    const used = [];
    const orphan = [];
    for (const f of files) {
      if (refs.has(f.url)) used.push(f);
      else orphan.push(f);
    }
    return { used, orphan };
  };

  const be = classify(beFiles);
  const fe = classify(feFiles);

  // duplicates: same relative path in BE and FE
  const beSet = new Set(beFiles.map((f) => f.url));
  const feSet = new Set(feFiles.map((f) => f.url));
  const dupes = [...beSet].filter((u) => feSet.has(u));

  // legacy /themes vs /images/themes
  const legacyThemes = beFiles.filter((f) => f.url.startsWith('/themes/'));
  const imagesThemes = beFiles.filter((f) => f.url.startsWith('/images/themes/'));

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({
    dbAndCodeRefs: [...refs].sort(),
    backend: { total: beFiles.length, used: be.used.length, orphan: be.orphan.map((f) => f.url) },
    frontend: { total: feFiles.length, used: fe.used.length, orphan: fe.orphan.map((f) => f.url) },
    duplicatedSamePathInBeAndFe: dupes.sort(),
    backendLegacyThemesFolder: legacyThemes.map((f) => f.url),
    backendImagesThemesFolder: imagesThemes.map((f) => f.url),
    uploadsDirExists: fs.existsSync(path.join(BE, 'uploads')),
  }, null, 2));

  await c.end();
})().catch((e) => { console.error(e); process.exit(1); });
