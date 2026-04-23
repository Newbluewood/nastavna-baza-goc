// test-openai-embedding.js
// Run: node test-openai-embedding.js
// Requires: npm install openai dotenv

const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  const text = 'This is a test sentence for embedding.';
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    const embedding = response.data[0].embedding;
    console.log('Embedding vector length:', embedding.length);
    console.log('First 5 values:', embedding.slice(0, 5));
  } catch (err) {
    console.error('OpenAI embedding failed:', err.response?.data || err.message);
  }
}

main();
