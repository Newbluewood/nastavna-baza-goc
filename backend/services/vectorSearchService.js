// vectorSearchService.js
// Provides semantic search using Qdrant vector DB

const { QdrantClient } = require('@qdrant/js-client-rest');
const { getEmbedding } = require('./embeddingService');

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'facts_collection';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

const qdrantClientOptions = { url: QDRANT_URL };
if (QDRANT_API_KEY) qdrantClientOptions.apiKey = QDRANT_API_KEY;

const client = new QdrantClient(qdrantClientOptions);

async function upsertFact(id, text, payload = {}) {
  const vector = await getEmbedding(text, { gemini: { role: 'document' } });
  // Force id to be integer (Qdrant default)
  const intId = typeof id === 'number' ? id : Date.now();
  // Debug: print vector length and sample
  console.log('Qdrant upsert debug:', {
    id: intId,
    vectorLength: Array.isArray(vector) ? vector.length : 'not array',
    vectorSample: Array.isArray(vector) ? vector.slice(0, 5) : vector,
    payload: { text, ...payload }
  });
  await client.upsert(QDRANT_COLLECTION, {
    points: [{
      id: intId,
      vector,
      payload: { text, ...payload }
    }]
  });
}

async function searchFacts(query, topK = 5) {
  const vector = await getEmbedding(query, { gemini: { role: 'query' } });
  const result = await client.search(QDRANT_COLLECTION, {
    vector,
    limit: topK
  });
  return result.map(r => r.payload);
}

/**
 * Deterministic FNV-1a 32-bit string hash. Produces a stable unsigned
 * integer suitable for use as a Qdrant point ID when the logical ID is
 * a string (e.g. "route:/smestaj").
 * @param {string} s
 * @returns {number}
 */
function stringToNumericId(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619 >>> 0;
  return h;
}

/**
 * Create a collection if it doesn't exist. Idempotent.
 * If the collection already exists and `opts.size` is provided, the
 * existing vector size is validated and a clear error is thrown on mismatch.
 * @param {string} collectionName
 * @param {{ size?: number, distance?: string }} [opts]
 */
async function ensureCollection(collectionName, opts = {}) {
  if (!collectionName || typeof collectionName !== 'string') {
    throw new Error('ensureCollection: collectionName must be a non-empty string');
  }
  const size = opts.size || 384;
  const distance = opts.distance || 'Cosine';

  const { collections = [] } = await client.getCollections();
  const existing = collections.find(c => c.name === collectionName);

  if (!existing) {
    await client.createCollection(collectionName, {
      vectors: { size, distance }
    });
    return;
  }

  if (opts.size) {
    let existingSize;
    try {
      const info = await client.getCollection(collectionName);
      // Qdrant may return either { config: { params: { vectors: { size } } } }
      // or { config: { params: { vectors: { <name>: { size } } } } } for
      // named vectors. Support both shapes.
      const vectorsCfg = info && info.config && info.config.params && info.config.params.vectors;
      if (vectorsCfg && typeof vectorsCfg.size === 'number') {
        existingSize = vectorsCfg.size;
      } else if (vectorsCfg && typeof vectorsCfg === 'object') {
        const first = Object.values(vectorsCfg)[0];
        if (first && typeof first.size === 'number') existingSize = first.size;
      }
    } catch (e) {
      // If we cannot read config, skip size validation silently rather than
      // failing the whole seed. The upsert call would surface a real mismatch.
      return;
    }

    if (typeof existingSize === 'number' && existingSize !== opts.size) {
      throw new Error(
        `ensureCollection: collection "${collectionName}" exists with vector size ${existingSize}, ` +
        `but requested size is ${opts.size}. Refusing to auto-modify — please migrate manually ` +
        `(e.g. delete the collection in Qdrant and re-run the seed).`
      );
    }
  }
}

/**
 * Search a named collection. Does NOT use QDRANT_COLLECTION default.
 * @param {string} query
 * @param {string} collectionName
 * @param {number} [topK=5]
 * @param {object} [filter] optional Qdrant filter object passed as-is
 * @returns {Promise<Array<{ payload:object, score:number, id:(string|number) }>>}
 */
async function searchInCollection(query, collectionName, topK = 5, filter) {
  if (!collectionName || typeof collectionName !== 'string') {
    throw new Error('searchInCollection: collectionName must be a non-empty string');
  }

  const { collections = [] } = await client.getCollections();
  if (!collections.find(c => c.name === collectionName)) {
    throw new Error(
      `searchInCollection: Qdrant collection "${collectionName}" does not exist. ` +
      `Run the corresponding seed script (e.g. "npm run seed:site-kb") before querying.`
    );
  }

  const vector = await getEmbedding(query);
  const searchParams = { vector, limit: topK };
  if (filter) searchParams.filter = filter;

  const result = await client.search(collectionName, searchParams);
  return result.map(r => ({ id: r.id, score: r.score, payload: r.payload }));
}

/**
 * Upsert into a named collection. Does NOT use QDRANT_COLLECTION default.
 * Accepts numeric or string ids; strings that aren't numeric are hashed
 * deterministically via FNV-1a so re-runs stay idempotent.
 * @param {number|string} id
 * @param {string} text
 * @param {object} [payload]
 * @param {string} collectionName
 */
async function upsertInCollection(id, text, payload = {}, collectionName) {
  if (!collectionName || typeof collectionName !== 'string') {
    throw new Error('upsertInCollection: collectionName must be a non-empty string');
  }

  let intId;
  if (typeof id === 'number' && Number.isFinite(id)) {
    intId = id;
  } else if (typeof id === 'string' && id.length > 0 && /^\d+$/.test(id)) {
    intId = Number(id);
  } else if (typeof id === 'string' && id.length > 0) {
    intId = stringToNumericId(id);
  } else {
    throw new Error('upsertInCollection: id must be a number or non-empty string');
  }

  const vector = await getEmbedding(text);
  await client.upsert(collectionName, {
    points: [{
      id: intId,
      vector,
      payload: { text, ...payload }
    }]
  });
}

/**
 * Shared Qdrant client instance (for tests and admin tools).
 * @returns {QdrantClient}
 */
function getClient() {
  return client;
}

module.exports = {
  upsertFact,
  searchFacts,
  searchInCollection,
  upsertInCollection,
  ensureCollection,
  getClient,
  stringToNumericId
};
