'use strict';

const fetch = require('node-fetch');
const logger = require('../logger');

const GEMINI_API_KEY   = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-1.5-flash-latest';
const GEMINI_TIMEOUT_MS = 12_000;

/**
 * Builds the Gemini API request URL.
 */
function buildUrl() {
  const model = GEMINI_CHAT_MODEL.replace(/^models\//, '');
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

/**
 * Generic function to call Gemini API with a prompt.
 */
async function callGemini(systemPrompt, userMessage, contents = []) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.4,
      },
    };

    const response = await fetch(buildUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`);

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned an empty response');

    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fallback Chat (Existing functionality)
 */
async function askGemini(message, history = []) {
  const systemPrompt = `Ti si ljubazni asistent za Nastavnu bazu Goč. Odgovaraj kratko i na jeziku upita.`;
  
  const contents = history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(msg.content || '') }]
  }));
  contents.push({ role: 'user', parts: [{ text: message }] });

  return callGemini(systemPrompt, message, contents);
}

/**
 * Proofread and rewrite for Admin tools
 */
async function adminToolCall(type, text, options = {}) {
  const lang = options.lang || 'sr';
  const tone = options.tone || 'professional';
  
  let systemPrompt = '';
  if (type === 'proofread') {
    systemPrompt = `Ti si stručnjak za lekturu. Popravi gramatičke i pravopisne greške u sledećem tekstu na jeziku [${lang}]. Vrati SAMO ispravljen tekst, bez ikakvih komentara.`;
  } else {
    systemPrompt = `Ti si stručnjak za pisanje. Preformuliši sledeći tekst na jeziku [${lang}] koristeći ton: ${tone}. Vrati SAMO preformulisani tekst.`;
  }

  return callGemini(systemPrompt, text);
}

module.exports = { askGemini, adminToolCall };
