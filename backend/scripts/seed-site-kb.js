/**
 * Seeds backend/docs/site-structure.json + features.json into Qdrant collection site_kb.
 *
 * Prerequisites:
 *   - Qdrant reachable at QDRANT_URL (default http://localhost:6333)
 *   - Embedding provider configured:
 *       EMBEDDING_PROVIDER=local   → FastAPI server at EMBEDDING_URL (default http://127.0.0.1:8000)
 *       EMBEDDING_PROVIDER=huggingface → HUGGINGFACE_API_KEY set
 *
 * Usage:
 *   node backend/scripts/seed-site-kb.js
 *   (or: npm run seed:site-kb from backend/)
 *
 * Idempotent: re-running safely re-upserts all entries.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
  ensureCollection,
  upsertInCollection,
  stringToNumericId
} = require('../services/vectorSearchService');

const COLLECTION = 'site_kb';
const DOCS_DIR = path.join(__dirname, '..', 'docs');
const SITE_STRUCTURE_PATH = path.join(DOCS_DIR, 'site-structure.json');
const FEATURES_PATH = path.join(DOCS_DIR, 'features.json');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function buildText(entry) {
  const parts = [];
  if (entry.sr) parts.push(entry.sr);
  if (entry.en) parts.push(entry.en);
  if (Array.isArray(entry.keywords)) parts.push(...entry.keywords);
  return parts.join('\n');
}

async function seedRoutes() {
  const data = readJson(SITE_STRUCTURE_PATH);
  const routes = Array.isArray(data.routes) ? data.routes : [];

  let count = 0;
  for (const entry of routes) {
    if (!entry || !entry.path) {
      console.warn('[seed:site-kb] skipping route entry with no "path":', entry);
      continue;
    }
    const text = buildText(entry);
    const id = stringToNumericId('route:' + entry.path);
    const payload = {
      ...entry,
      kind: 'route',
      _source: 'site-structure.json'
    };
    await upsertInCollection(id, text, payload, COLLECTION);
    count += 1;
  }
  return count;
}

async function seedFeatures() {
  const data = readJson(FEATURES_PATH);
  const features = Array.isArray(data.features) ? data.features : [];

  let count = 0;
  for (const entry of features) {
    if (!entry || !entry.id) {
      console.warn('[seed:site-kb] skipping feature entry with no "id":', entry);
      continue;
    }
    const text = buildText(entry);
    const id = stringToNumericId('feature:' + entry.id);
    const payload = {
      ...entry,
      kind: 'feature',
      _source: 'features.json'
    };
    await upsertInCollection(id, text, payload, COLLECTION);
    count += 1;
  }
  return count;
}

async function main() {
  console.log(`[seed:site-kb] Ensuring Qdrant collection "${COLLECTION}" exists (384-dim, Cosine)...`);
  await ensureCollection(COLLECTION, { size: 384, distance: 'Cosine' });

  console.log('[seed:site-kb] Seeding routes from site-structure.json...');
  const nRoutes = await seedRoutes();

  console.log('[seed:site-kb] Seeding features from features.json...');
  const nFeatures = await seedFeatures();

  console.log(`[seed:site-kb] Seeded ${nRoutes} routes and ${nFeatures} features into ${COLLECTION}`);
}

main().catch(err => {
  console.error('[seed:site-kb] FAILED:', err);
  if (err && err.stack) console.error(err.stack);
  process.exit(1);
});
