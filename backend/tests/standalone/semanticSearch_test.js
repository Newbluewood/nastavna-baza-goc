// Standalone test for semantic search (Qdrant + embedding)
const { searchFacts, upsertFact } = require('./services/vectorSearchService');
const { QdrantClient } = require('@qdrant/js-client-rest');

function randomId() {
  return 'id-' + Math.random().toString(36).slice(2, 12);
}

(async () => {
  const testFact = {
    text: 'Na Goču se nalazi planinski restoran sa domaćom hranom.',
    payload: { type: 'restaurant', location: 'Goč' }
  };
  let insertedId;
  const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
  const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'facts_collection';
  const VECTOR_SIZE = 384;
  try {
    const client = new QdrantClient({ url: QDRANT_URL });
    try { await client.deleteCollection(QDRANT_COLLECTION); } catch (err) {}
    await client.createCollection(QDRANT_COLLECTION, { vectors: { size: VECTOR_SIZE, distance: 'Cosine' } });
    insertedId = randomId();
    await upsertFact(insertedId, testFact.text, testFact.payload);
    const results = await searchFacts('Gde mogu da jedem na Goču?', 3);
    if (Array.isArray(results) && results.length > 0 && results.find(f => (f.text || '').includes('restoran'))) {
      console.log('✔ Relevant fact found for restaurant query');
    } else {
      console.log('❗ No relevant fact found for restaurant query');
    }
  } catch (e) {
    console.error('❗ Test error:', e);
  }
})();
