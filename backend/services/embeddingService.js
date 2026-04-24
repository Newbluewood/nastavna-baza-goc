// embeddingService.js
// Provides embedding vectors via local, OpenAI, or HuggingFace providers.
// Features: provider-aware routing, timeout + retry wrapping, EmbeddingError.

const fetch = require('node-fetch');

const ALLOWED_PROVIDERS = ['local', 'openai', 'huggingface'];
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || 'local';

if (!ALLOWED_PROVIDERS.includes(EMBEDDING_PROVIDER)) {
  throw new Error(
    `[embeddingService] Unknown EMBEDDING_PROVIDER='${EMBEDDING_PROVIDER}'. ` +
      `Must be one of: ${ALLOWED_PROVIDERS.join(', ')}.`
  );
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HUGGINGFACE_EMBEDDING_MODEL =
  process.env.HUGGINGFACE_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';

const DEFAULT_LOCAL_URL = 'http://127.0.0.1:8000';
const DEFAULT_HF_URL = 'https://api-inference.huggingface.co';
const EMBEDDING_URL =
  process.env.EMBEDDING_URL ||
  (EMBEDDING_PROVIDER === 'huggingface' ? DEFAULT_HF_URL : DEFAULT_LOCAL_URL);

const EMBEDDING_TIMEOUT_MS = parseInt(process.env.EMBEDDING_TIMEOUT_MS, 10) || 3000;
const _r = parseInt(process.env.EMBEDDING_RETRY_COUNT, 10);
const EMBEDDING_RETRY_COUNT = Number.isFinite(_r) && _r >= 0 ? _r : 1;

if (EMBEDDING_PROVIDER === 'huggingface' && !HUGGINGFACE_API_KEY) {
  throw new Error('[embeddingService] EMBEDDING_PROVIDER=huggingface but HUGGINGFACE_API_KEY is not set.');
}

class EmbeddingError extends Error {
  constructor(message, { provider, cause, status } = {}) {
    super(message);
    this.name = 'EmbeddingError';
    this.provider = provider;
    this.cause = cause;
    this.status = status;
  }
}

function debugLog(...args) {
  if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_EMBEDDING === 'true') {
    console.log('[embeddingService]', ...args);
  }
}

function stripTrailingSlash(u) {
  return u.replace(/\/+$/, '');
}

function isRetryable(err) {
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  if (typeof err.status === 'number') {
    const s = err.status;
    if (s === 408 || s === 429) return true;
    return s >= 500 && s < 600;
  }
  return true;
}

async function readPreview(response) {
  try {
    const text = await response.text();
    return text.slice(0, 200);
  } catch (_) {
    return '';
  }
}

async function fetchWithTimeoutAndRetry(doCall, { timeoutMs, retries }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await doCall(controller.signal);
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) throw err;
      debugLog(`attempt ${attempt + 1}/${retries + 1} failed: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

async function callLocal(text, signal) {
  const response = await fetch(`${stripTrailingSlash(EMBEDDING_URL)}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!response.ok) {
    const preview = await readPreview(response);
    const err = new Error(`local HTTP ${response.status}: ${preview}`);
    err.status = response.status;
    throw err;
  }
  const data = await response.json();
  if (!data || !data.embedding) throw new Error('Local embedding response missing "embedding" field');
  return data.embedding;
}

async function callOpenAI(text, signal) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: 'text-embedding-ada-002', input: text }),
    signal,
  });
  if (!response.ok) {
    const preview = await readPreview(response);
    const err = new Error(`openai HTTP ${response.status}: ${preview}`);
    err.status = response.status;
    throw err;
  }
  const data = await response.json();
  if (!data || !data.data || !data.data[0] || !data.data[0].embedding) {
    throw new Error('OpenAI embedding response malformed');
  }
  return data.data[0].embedding;
}

async function callHuggingFace(text, signal) {
  const url = `${stripTrailingSlash(EMBEDDING_URL)}/pipeline/feature-extraction/${HUGGINGFACE_EMBEDDING_MODEL}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
    },
    body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    signal,
  });
  if (!response.ok) {
    const preview = await readPreview(response);
    const err = new Error(`huggingface HTTP ${response.status}: ${preview}`);
    err.status = response.status;
    throw err;
  }
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('HuggingFace response was not an array');
  if (data.length === 1 && Array.isArray(data[0])) return data[0];
  return data;
}

function getDispatcher() {
  if (EMBEDDING_PROVIDER === 'openai') return callOpenAI;
  if (EMBEDDING_PROVIDER === 'huggingface') return callHuggingFace;
  return callLocal;
}

async function getEmbedding(text) {
  const dispatcher = getDispatcher();
  try {
    return await fetchWithTimeoutAndRetry(
      (signal) => dispatcher(text, signal),
      { timeoutMs: EMBEDDING_TIMEOUT_MS, retries: EMBEDDING_RETRY_COUNT }
    );
  } catch (err) {
    throw new EmbeddingError(
      `Embedding failed for provider '${EMBEDDING_PROVIDER}': ${err.message}`,
      { provider: EMBEDDING_PROVIDER, cause: err, status: err && err.status }
    );
  }
}

async function isEmbeddingAvailable() {
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('isEmbeddingAvailable: 2s timeout')), 2000)
    );
    const result = await Promise.race([getEmbedding('ping'), timeout]);
    return Array.isArray(result) && result.length > 0;
  } catch (_) {
    return false;
  }
}

module.exports = {
  getEmbedding,
  isEmbeddingAvailable,
  EmbeddingError,
  EMBEDDING_PROVIDER,
};
