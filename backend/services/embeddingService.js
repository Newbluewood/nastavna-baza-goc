// embeddingService.js
// Provides embedding vector for a given text using local, OpenAI, or Gemini (Google AI) API.

const fetch = require('node-fetch');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || 'local'; // 'local' | 'openai' | 'gemini'
/** Full URL to POST JSON `{ text }` and receive `{ embedding: number[] }` (FastAPI embending-service). */
const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || 'http://127.0.0.1:8000/embed';
const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
const GEMINI_EMBEDDING_OUTPUT_DIM = process.env.GEMINI_EMBEDDING_OUTPUT_DIM
  ? parseInt(process.env.GEMINI_EMBEDDING_OUTPUT_DIM, 10)
  : null;

/**
 * @param {string} text
 * @param {{ gemini?: { role?: 'query' | 'document' } }} [options] Used when EMBEDDING_PROVIDER=gemini (retrieval tuning).
 */
async function getEmbedding(text, options = {}) {
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
  }
  if (EMBEDDING_PROVIDER === 'gemini') {
    return getGeminiEmbedding(text, options);
  }
  // Local embedding service (see Desktop embending-service / uvicorn main:app)
  const response = await fetch(EMBEDDING_SERVICE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!response.ok) throw new Error(`Local embedding HTTP ${response.status}`);
  const data = await response.json();
  if (!data.embedding) throw new Error('Local embedding failed');
  return data.embedding;
}

function geminiEmbedTextForModel(text, role, modelId) {
  if (!String(modelId).includes('embedding-2')) return text;
  // Asymmetric retrieval formatting recommended for gemini-embedding-2 (see Google embeddings docs).
  if (role === 'document') return `title: none | text: ${text}`;
  return `task: search result | query: ${text}`;
}

function parseGeminiEmbedResponse(data) {
  if (data.embedding && Array.isArray(data.embedding.values)) return data.embedding.values;
  if (Array.isArray(data.embeddings) && data.embeddings[0] && Array.isArray(data.embeddings[0].values)) {
    return data.embeddings[0].values;
  }
  return null;
}

async function getGeminiEmbedding(text, options = {}) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY (or GOOGLE_API_KEY) is required when EMBEDDING_PROVIDER=gemini');
  const role = options.gemini && options.gemini.role === 'document' ? 'document' : 'query';
  const modelId = GEMINI_EMBEDDING_MODEL.replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:embedContent`;
  const embedText = geminiEmbedTextForModel(text, role, modelId);

  /** @type {Record<string, unknown>} */
  const body = {
    content: { parts: [{ text: embedText }] }
  };

  if (String(modelId).includes('embedding-2')) {
    body.model = `models/${modelId}`;
  }
  if (String(modelId).includes('embedding-001')) {
    body.taskType = role === 'document' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY';
  }

  if (GEMINI_EMBEDDING_OUTPUT_DIM && Number.isFinite(GEMINI_EMBEDDING_OUTPUT_DIM) && GEMINI_EMBEDDING_OUTPUT_DIM > 0) {
    body.outputDimensionality = GEMINI_EMBEDDING_OUTPUT_DIM;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    const msg = data.error && (data.error.message || JSON.stringify(data.error));
    throw new Error(msg || `Gemini embedding HTTP ${response.status}`);
  }
  const values = parseGeminiEmbedResponse(data);
  if (!values || !values.length) throw new Error('Gemini embedding failed: empty or unknown response shape');
  return values;
}

module.exports = { getEmbedding };