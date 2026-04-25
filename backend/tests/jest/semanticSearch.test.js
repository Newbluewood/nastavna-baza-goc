// semanticSearch.test.js
// Integration test for semantic search (Qdrant + embedding).
// Opt-in only, because it requires external services/keys.

const { searchFacts, upsertFact } = require('../../services/vectorSearchService');
const { QdrantClient } = require('@qdrant/js-client-rest');


// Use a simple random string for test IDs to avoid uuid ESM/CJS issues
function randomId() {
  return 'id-' + Math.random().toString(36).slice(2, 12);
}

const RUN_INTEGRATION = String(process.env.RUN_INTEGRATION_TESTS || 'false') === 'true';

(RUN_INTEGRATION ? describe : describe.skip)('Semantic Search (Qdrant)', () => {
  const testFact = {
    text: 'Na Goču se nalazi planinski restoran sa domaćom hranom.',
    payload: { type: 'restaurant', location: 'Goč' }
  };
  let insertedId;
  const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
  const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'facts_collection';
  // Set this to match your embedding vector size (MiniLM: 384, OpenAI: 1536)
  const VECTOR_SIZE = 384; // Confirmed by local embedding service

  beforeAll(async () => {
    // Ensure collection exists with correct vector size: delete if exists, then create
    const client = new QdrantClient({ url: QDRANT_URL });
    try {
      await client.deleteCollection(QDRANT_COLLECTION);
    } catch (err) {
      // Ignore if not found
    }
    await client.createCollection(QDRANT_COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    });
    insertedId = randomId();
    await upsertFact(insertedId, testFact.text, testFact.payload);
  });

  it('finds relevant fact for restaurant query', async () => {
    const results = await searchFacts('Gde mogu da jedem na Goču?', 3);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    const found = results.find(f => (f.text || '').includes('restoran'));
    expect(found).toBeDefined();
  });
});
