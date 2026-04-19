const aiService = require('../services/aiService');
const { sendError } = require('../utils/response');

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function getLimitConfig() {
  return {
    maxInputWords: Number.parseInt(process.env.AI_MAX_INPUT_WORDS || '100', 10),
    maxInputChars: Number.parseInt(process.env.AI_MAX_INPUT_CHARS || '700', 10)
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
  return res.json(aiService.getStatus());
}

async function proofread(req, res) {
  const status = aiService.getStatus();
  if (!status.enabled) {
    return res.json({
      enabled: false,
      fallback: true,
      message: 'AI is disabled. Continue manually.',
      status
    });
  }

  const { text, lang } = req.body || {};
  if (!text || typeof text !== 'string') {
    return sendError(res, 400, 'Text is required');
  }

  if (!validateInputText(text, res)) {
    return;
  }

  const result = await aiService.proofread(text, lang || 'sr');
  return res.json({ enabled: true, fallback: false, ...result });
}

async function rewrite(req, res) {
  const status = aiService.getStatus();
  if (!status.enabled) {
    return res.json({
      enabled: false,
      fallback: true,
      message: 'AI is disabled. Continue manually.',
      status
    });
  }

  const { text, lang, tone } = req.body || {};
  if (!text || typeof text !== 'string') {
    return sendError(res, 400, 'Text is required');
  }

  if (!validateInputText(text, res)) {
    return;
  }

  const result = await aiService.rewrite(text, {
    lang: lang || 'sr',
    tone: tone || 'professional'
  });

  return res.json({ enabled: true, fallback: false, ...result });
}

module.exports = {
  pingAI,
  proofread,
  rewrite
};
