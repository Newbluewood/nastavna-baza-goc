// test-openai-embedding.js
// Optional manual check (openai SDK removed from runtime deps).
// Run: npm install openai dotenv && node tests/standalone/test-openai-embedding.js

require('dotenv').config();

async function main() {
  let OpenAI;
  try {
    ({ OpenAI } = require('openai'));
  } catch {
    console.error('Install optional peer first: npm install openai');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
