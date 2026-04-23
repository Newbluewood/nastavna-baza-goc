// test-embedding-local.js
// Run: node test-embedding-local.js
// Requires: npm install axios

const axios = require('axios');

async function getLocalEmbedding(text) {
  try {
    const response = await axios.post('http://127.0.0.1:8000/embed', { text });
    const embedding = response.data.embedding;
    console.log('Embedding vector length:', embedding.length);
    console.log('First 5 values:', embedding.slice(0, 5));
    return embedding;
  } catch (err) {
    console.error('Local embedding failed:', err.response?.data || err.message);
  }
}

getLocalEmbedding('This is a test sentence for embedding.');
