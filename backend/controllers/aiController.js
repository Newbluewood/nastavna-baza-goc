'use strict';

const { adminToolCall } = require('../services/geminiChatService');
const { sendError } = require('../utils/response');

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function getLimitConfig() {
  return {
    maxInputWords: Number.parseInt(process.env.AI_MAX_INPUT_WORDS || '300', 10),
    maxInputChars: Number.parseInt(process.env.AI_MAX_INPUT_CHARS || '2000', 10)
  };
}

function validateInputText(text, res) {
  const cfg = getLimitConfig();
  const input = String(text || '');
  const wordCount = countWords(input);

  if (input.length > cfg.maxInputChars) {
    sendError(res, 400, `Text too long. Maximum is ${cfg.maxInputChars} characters.`);
    return false;
  }

  if (wordCount > cfg.maxInputWords) {
    sendError(res, 400, `Text too long. Maximum is ${cfg.maxInputWords} words.`);
    return false;
  }

  return true;
}

async function pingAI(req, res) {
  const enabled = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  return res.json({ 
    enabled, 
    model: 'gemini-1.5-flash',
    status: enabled ? 'active' : 'api_key_missing'
  });
}

async function proofread(req, res) {
  const { text, lang } = req.body || {};
  if (!text || typeof text !== 'string') return sendError(res, 400, 'Text is required');
  if (!validateInputText(text, res)) return;

  try {
    const correctedText = await adminToolCall('proofread', text, { lang: lang || 'sr' });
    return res.json({ 
      enabled: true, 
      correctedText,
      originalText: text
    });
  } catch (err) {
    return sendError(res, 500, `AI Error: ${err.message}`);
  }
}

async function rewrite(req, res) {
  const { text, lang, tone } = req.body || {};
  if (!text || typeof text !== 'string') return sendError(res, 400, 'Text is required');
  if (!validateInputText(text, res)) return;

  try {
    const rewrittenText = await adminToolCall('rewrite', text, { 
      lang: lang || 'sr', 
      tone: tone || 'professional' 
    });
    return res.json({ 
      enabled: true, 
      rewrittenText,
      originalText: text
    });
  } catch (err) {
    return sendError(res, 500, `AI Error: ${err.message}`);
  }
}

module.exports = { pingAI, proofread, rewrite };
