'use strict';

const fetch = require('node-fetch');
const logger = require('../logger');

const GEMINI_API_KEY   = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 12_000;

/**
 * Builds the Gemini API request URL.
 */
function buildUrl() {
  const model = GEMINI_CHAT_MODEL.startsWith('models/') ? GEMINI_CHAT_MODEL : `models/${GEMINI_CHAT_MODEL}`;
  return `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

/**
 * Generic function to call Gemini API with a prompt.
 */
async function callGemini(systemPrompt, contents) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: contents,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    };

    const response = await fetch(buildUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      const msg = data?.error?.message || `Gemini HTTP ${response.status}`;
      throw new Error(msg);
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned an empty response');

    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fallback Chat
 */
async function askGemini(message, history = []) {
  const systemPrompt = `Ti si ljubazni asistent za Nastavnu bazu Goč Šumarskog fakulteta. Odgovaraj kratko, ljubazno i na jeziku upita korisnika.`;
  
  // Format history and ensure alternating roles (User -> Model -> User)
  const contents = [];
  
  // Filter history to remove any empty content or invalid roles
  const validHistory = (history || []).filter(h => h.content && h.content.trim() !== '');
  
  validHistory.forEach(msg => {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  });

  // Always append the current user message at the end
  contents.push({
    role: 'user',
    parts: [{ text: message }]
  });

  // CRITICAL: Gemini requires the last message to be from 'user' 
  // and roles must alternate. If two 'user' messages are consecutive, 
  // we should merge them or clean up.
  
  const cleanedContents = [];
  contents.forEach((item, index) => {
    if (index > 0 && item.role === cleanedContents[cleanedContents.length - 1].role) {
      // Merge consecutive same-role messages
      cleanedContents[cleanedContents.length - 1].parts[0].text += '\n' + item.parts[0].text;
    } else {
      cleanedContents.push(item);
    }
  });

  return callGemini(systemPrompt, cleanedContents);
}

/**
 * Admin tools
 */
async function adminToolCall(type, text, options = {}) {
  const lang = options.lang || 'sr';
  const tone = options.tone || 'professional';
  
  let systemPrompt = '';
  if (type === 'proofread') {
    systemPrompt = `Popravi gramatičke i pravopisne greške u tekstu na jeziku [${lang}]. Vrati samo ispravljen tekst.`;
  } else {
    systemPrompt = `Preformuliši tekst na jeziku [${lang}] koristeći ${tone} ton. Vrati samo rezultat.`;
  }

  const contents = [{ role: 'user', parts: [{ text }] }];
  return callGemini(systemPrompt, contents);
}

module.exports = { askGemini, adminToolCall };
