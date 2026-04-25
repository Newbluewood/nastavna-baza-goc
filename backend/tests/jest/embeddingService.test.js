// embeddingService.test.js
// Jest test for local Python embedding service using fetch

const EMBED_URL = process.env.EMBEDDING_SERVICE_URL || 'http://127.0.0.1:8000/embed';

describe('Local Embedding Service', () => {
  it('returns a valid embedding vector for a test sentence', async () => {
    const response = await fetch(EMBED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'This is a test sentence for embedding.' })
    });
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(Array.isArray(data.embedding)).toBe(true);
    expect(data.embedding.length).toBeGreaterThan(0);
    expect(typeof data.embedding[0]).toBe('number');
  });
});
