// vectorSearchService.js
// Provides semantic search using Qdrant vector DB

const { QdrantClient } = require('@qdrant/js-client-rest');
const { getEmbedding } = require('./embeddingService');

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'facts_collection';

const client = new QdrantClient({ url: QDRANT_URL });

async function upsertFact(id, text, payload = {}) {
  const vector = await getEmbedding(text);
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
  const vector = await getEmbedding(query);
  const result = await client.search(QDRANT_COLLECTION, {
    vector,
    limit: topK
  });
  return result.map(r => r.payload);
}

module.exports = { upsertFact, searchFacts };