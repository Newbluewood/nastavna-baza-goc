// test-qdrant.js
// Run: node test-qdrant.js

const { QdrantClient } = require('@qdrant/js-client-rest');

async function main() {
  const client = new QdrantClient({ url: 'http://localhost:6333' });
  try {
    // Create a collection named 'test_collection' with vector size 1536 (OpenAI embedding size)
    await client.createCollection('test_collection', {
      vectors: { size: 1536, distance: 'Cosine' },
    });
    console.log('✔ Qdrant connection successful and collection created!');
  } catch (err) {
    if (err.status === 409) {
      console.log('✔ Collection already exists. Qdrant connection successful!');
    } else {
      console.error('❗ Qdrant connection failed:', err);
    }
  }
}

main();
