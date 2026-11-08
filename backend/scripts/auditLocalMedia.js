/**
 * Audit local image files vs DB + code references.
 * Usage: node scripts/auditLocalMedia.js
 *        node scripts/auditLocalMedia.js --delete-orphans
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const ROOT = path.join(__dirname, '..', '..');
const BACKEND_PUBLIC = path.join(__dirname, '..', 'public');
const FRONTEND_PUBLIC = path.join(ROOT, 'frontend', 'public');
const DELETE = process.argv.includes('--delete-orphans');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);

function walkImages(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkImages(full, acc);
    else if (IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) acc.push(full);
  }
  return acc;
}

function toPublicUrl(absPath, publicRoot, urlPrefix) {
  const rel = path.relative(publicRoot, absPath).split(path.sep).join('/');
  return `${urlPrefix}/${rel}`;
}

function normalizeRef(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (!s.startsWith('/')) s = `/${s}`;
  return s;
}

async function collectDbRefs(conn) {
  const refs = new Set();
  const add = (v) => {
    const n = normalizeRef(v);
    if (n) refs.add(n);
  };

  const tryQuery = async (sql, cols) => {
    try {
      const [rows] = await conn.query(sql);
      for (const row of rows) {
        for (const col of cols) add(row[col]);
      }
    } catch (err) {
      console.warn(`[skip] ${sql.split('\n')[0]} → ${err.code || err.message}`);
    }
  };

  await tryQuery('SELECT cover_image, floor_plan_image FROM facilities', ['cover_image', 'floor_plan_image']);
  await tryQuery('SELECT cover_image, floor_plan_image FROM rooms', ['cover_image', 'floor_plan_image']);
  await tryQuery('SELECT cover_image FROM news', ['cover_image']);
  await tryQuery('SELECT image_url FROM media_gallery', ['image_url']);
  await tryQuery('SELECT image_url FROM hero_slides', ['image_url']);
  await tryQuery('SELECT photo_url FROM staff', ['photo_url']);
  await tryQuery('SELECT cover_image FROM restaurants', ['cover_image']);
  await tryQuery('SELECT image_url FROM menu_items', ['image_url']);
  await tryQuery('SELECT cover_image FROM themes', ['cover_image']);
  await tryQuery('SELECT image_url FROM themes', ['image_url']);
  await tryQuery('SELECT hero_image FROM pages', ['hero_image']);
  await tryQuery('SELECT cover_image FROM pages', ['cover_image']);

  return refs;
}

function collectCodeRefs() {
  const refs = new Set();
  const roots = [
    path.join(ROOT, 'frontend', 'src'),
    path.join(ROOT, 'backend'),
  ];
  const fileExt = new Set(['.js', '.vue', '.ts', '.css', '.html', '.md', '.sql']);

  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!fileExt.has(path.extname(entry.name).toLowerCase())) continue;
      const text = fs.readFileSync(full, 'utf8');
      const re = /(?:\/(?:uploads|images|themes|placeholder)[^"'`\s)]+\.(?:jpg|jpeg|png|webp|gif|svg)|placeholder\.jpg|placeholder-staff\.svg)/gi;
      let m;
      while ((m = re.exec(text))) {
        const n = normalizeRef(m[0]);
        if (n) refs.add(n);
      }
    }
  };

  for (const r of roots) walk(r);
  return refs;
}

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    ssl: process.env.DB_SSL === 'REQUIRED' ? { rejectUnauthorized: false } : undefined,
  });

  const dbRefs = await collectDbRefs(conn);
  const codeRefs = collectCodeRefs();
  const allRefs = new Set([...dbRefs, ...codeRefs]);

  const backendFiles = walkImages(BACKEND_PUBLIC).map((abs) => ({
    abs,
    url: toPublicUrl(abs, BACKEND_PUBLIC, ''),
    zone: 'backend/public',
  }));
  const frontendFiles = walkImages(FRONTEND_PUBLIC).map((abs) => ({
    abs,
    url: toPublicUrl(abs, FRONTEND_PUBLIC, ''),
    zone: 'frontend/public',
  }));

  // Also check backend/public/uploads specifically
  const uploadsDir = path.join(BACKEND_PUBLIC, 'uploads');
  const uploadFiles = walkImages(uploadsDir);

  const used = [];
  const orphans = [];

  for (const file of [...backendFiles, ...frontendFiles]) {
    const candidates = [file.url, file.url.replace(/^\//, '')];
    const hit = candidates.some((c) => allRefs.has(c) || allRefs.has(`/${c.replace(/^\//, '')}`));
    // Match by basename for themes duplicated under /themes and /images/themes
    const base = path.basename(file.abs);
    const baseHit = [...allRefs].some((r) => r.endsWith(`/${base}`) || r === `/${base}` || r.endsWith(base));
    if (hit || baseHit) used.push(file);
    else orphans.push(file);
  }

  const dbLocalMissing = [...dbRefs].filter((r) => {
    if (/^https?:/i.test(r)) return false;
    if (/placeholder/i.test(r)) return false;
    // resolve against backend public
    const rel = r.replace(/^\//, '');
    const abs = path.join(BACKEND_PUBLIC, rel);
    const absFe = path.join(FRONTEND_PUBLIC, rel);
    return !fs.existsSync(abs) && !fs.existsSync(absFe);
  });

  const placeholderRows = [...dbRefs].filter((r) => /placeholder/i.test(r));

  console.log(JSON.stringify({
    summary: {
      dbRefs: dbRefs.size,
      codeRefs: codeRefs.size,
      backendPublicImages: backendFiles.length,
      frontendPublicImages: frontendFiles.length,
      uploadFilesOnDisk: uploadFiles.length,
      usedLocalFiles: used.length,
      orphanLocalFiles: orphans.length,
      dbLocalPathsMissingOnDisk: dbLocalMissing.length,
      placeholderRefsInDb: placeholderRows.length,
    },
    placeholderRefsInDb: placeholderRows.sort(),
    dbLocalPaths: [...dbRefs].filter((r) => !/^https?:/i.test(r)).sort(),
    orphanLocalFiles: orphans.map((f) => ({ zone: f.zone, url: f.url, abs: f.abs })),
    usedLocalSample: used.slice(0, 40).map((f) => ({ zone: f.zone, url: f.url })),
    dbLocalMissing,
    uploadsOnDisk: uploadFiles.map((f) => path.relative(uploadsDir, f)),
  }, null, 2));

  if (DELETE && orphans.length) {
    for (const f of orphans) {
      fs.unlinkSync(f.abs);
      console.log(`DELETED ${f.abs}`);
    }
  } else if (DELETE) {
    console.log('No orphans to delete.');
  }

  await conn.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
