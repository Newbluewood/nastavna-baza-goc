'use strict';

/**
 * geminiChatService.js
 *
 * Lightweight fallback chat powered by Gemini Flash (free tier: 1 500 req/day).
 * Used when the primary microservice (Render) is unavailable.
 *
 * Env:
 *   GEMINI_API_KEY   — Google AI API key (required)
 *   GEMINI_CHAT_MODEL — model name, default: gemini-1.5-flash-latest
 *
 * The service does NOT depend on Qdrant, embeddings, or budget tracking — it is
 * intentionally simple so that it stays available even if auxiliary services fail.
 */

const fetch = require('node-fetch');
const logger = require('../logger');

const GEMINI_API_KEY   = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-1.5-flash-latest';
const GEMINI_TIMEOUT_MS = 12_000;

const SYSTEM_PROMPT = `Ti si ljubazni asistent za Nastavnu bazu Goč Šumarskog fakulteta Univerziteta u Beogradu.
Odgovaraj kratko, prijatno i iskreno. Ako ne znaš tačan odgovor, reci to jasno.
Oblasti o kojima možeš da pomogneš:
- Smeštaj i rezervacije (sobe, cene, dostupnost)
- Restoran i hrana
- Aktivnosti na Goču (planinarenje, skijaške staze, lov, ribolov)
- Ekosistem rezervata (flora, fauna, gljive, pejzaž)
- Istorijat baze (Universitetet u Beogradu, Šumarski fakultet)
- Laboratorije, pilana, sušara, kampus
- Kontakt i opšte informacije
Ako korisnik piše na srpskom, odgovaraj na srpskom. Ako piše na engleskom, odgovaraj na engleskom.
Odgovor neka bude do 200 reči.`;

/**
 * Builds the Gemini API request URL.
 * @returns {string}
 */
function buildUrl() {
  const model = GEMINI_CHAT_MODEL.replace(/^models\//, '');
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

/**
 * Converts a simple [{role, content}] history array into Gemini's `contents` format.
 * Gemini alternates user/model roles — any assistant message becomes "model".
 *
 * @param {Array<{role: string, content: string}>} history
 * @param {string} currentMessage
 * @returns {Array<{role: string, parts: [{text: string}]}>}
 */
function buildContents(history, currentMessage) {
  const contents = [];

  for (const msg of history) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    contents.push({ role, parts: [{ text: String(msg.content || '') }] });
  }

  contents.push({ role: 'user', parts: [{ text: currentMessage }] });
  return contents;
}

/**
 * Sends a message to Gemini Flash and returns the reply text.
 *
 * @param {string} message                                — current user message
 * @param {Array<{role:string,content:string}>} [history] — recent conversation turns
 * @returns {Promise<string>}                             — assistant reply text
 * @throws {Error} on API failure or timeout
 */
async function askGemini(message, history = []) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: buildContents(history, message),
        generationConfig: {
          maxOutputTokens: 400,
          temperature: 0.4,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || `Gemini HTTP ${response.status}`;
      throw new Error(errMsg);
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned an empty response');

    return text.trim();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Gemini fallback timed out');
    }
    logger.error(`[geminiChatService] ${err.message}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { askGemini };
