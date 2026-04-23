// embeddingService.js
// Provides embedding vector for a given text using local or OpenAI provider

const fetch = require('node-fetch');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || 'local'; // 'local' or 'openai'

async function getEmbedding(text) {
  if (EMBEDDING_PROVIDER === 'openai') {
    // OpenAI embedding
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      })
    });
    const data = await response.json();
    if (!data.data || !data.data[0] || !data.data[0].embedding) throw new Error('OpenAI embedding failed');
    return data.data[0].embedding;
  } else {
    // Local embedding service
    const response = await fetch('http://127.0.0.1:8000/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await response.json();
    if (!data.embedding) throw new Error('Local embedding failed');
    return data.embedding;
  }
}

module.exports = { getEmbedding };