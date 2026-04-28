// test-embedding-local-fetch.js
// Run: node test-embedding-local-fetch.js

const EMBED_URL = process.env.EMBEDDING_SERVICE_URL || 'http://127.0.0.1:8000/embed';

async function getLocalEmbedding(text) {
  try {
    const response = await fetch(EMBED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    const embedding = data.embedding;
    console.log('Embedding vector length:', embedding.length);
    console.log('First 5 values:', embedding.slice(0, 5));
    return embedding;
  } catch (err) {
    console.error('Local embedding failed:', err.message);
  }
}

getLocalEmbedding('This is a test sentence for embedding.');
