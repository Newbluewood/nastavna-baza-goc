'use strict';

const crypto = require('crypto');
const db = require('../db');

const DEFAULT_MISS_CONFIDENCE_MAX = 0.35;
const SKIP_SOURCES = new Set(['greeting_turn', 'smalltalk_turn', 'server_clock']);

function missConfidenceMax() {
  const raw = Number.parseFloat(process.env.CHAT_MISS_CONFIDENCE_MAX || '');
  if (Number.isFinite(raw) && raw >= 0 && raw <= 1) return raw;
  return DEFAULT_MISS_CONFIDENCE_MAX;
}

function normalizeQuestion(raw) {
  return String(raw || '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 512);
}

function hashQuestion(questionNorm) {
  return crypto.createHash('sha256').update(String(questionNorm || '')).digest('hex');
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return Math.round(n * 10000) / 10000;
}

/**
 * Classify a site-guide AssistantTurn for analytics.
 * skip  = greeting / smalltalk / clock (not KB gaps)
 * miss  = no useful match or very low confidence
 * fallback = keyword/legacy path that still returned something
 * hit   = normal answered turn
 */
function classifySiteGuideTurn(turn) {
  const meta = turn && typeof turn.meta === 'object' && turn.meta ? turn.meta : {};
  const source = meta.source ? String(meta.source) : null;
  const reason = meta.reason ? String(meta.reason) : null;
  const fallback = meta.fallback ? String(meta.fallback) : null;
  const confidence = clamp01(turn?.confidence);

  if (source && SKIP_SOURCES.has(source)) {
    return { outcome: 'skip', reason: source, source, confidence };
  }

  if (
    fallback === 'no_keyword_match' ||
    reason === 'no_vector_hits' ||
    reason === 'vector_search_failed'
  ) {
    return { outcome: 'miss', reason: reason || fallback, source, confidence };
  }

  if (confidence != null && confidence < missConfidenceMax()) {
    return {
      outcome: 'miss',
      reason: reason || 'low_confidence',
      source: source || (fallback ? `fallback:${fallback}` : null),
      confidence
    };
  }

  if (fallback || reason === 'ai_disabled_or_mock' || reason === 'llm_call_failed') {
    return {
      outcome: 'fallback',
      reason: reason || fallback,
      source: source || (fallback ? `fallback:${fallback}` : null),
      confidence
    };
  }

  return {
    outcome: 'hit',
    reason: reason || null,
    source: source || (meta.model ? 'rag' : null),
    confidence
  };
}

function parseDays(raw, fallback = 30) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 365);
}

function parseLimit(raw, fallback = 20) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 100);
}

/**
 * Best-effort insert. Never throws to the chat path.
 */
async function recordSiteGuideQuery({
  question,
  lang = 'sr',
  turn,
  sessionId = null,
  userKey = null
}) {
  try {
    const questionNorm = normalizeQuestion(question);
    if (!questionNorm) return null;

    const classified = classifySiteGuideTurn(turn);
    const topScore = clamp01(
      Array.isArray(turn?.sources) && turn.sources[0] ? turn.sources[0].score : null
    );
    const meta = {
      intent: turn?.intent || null,
      hits: turn?.meta?.hits ?? null,
      model: turn?.meta?.model || null,
      fallback: turn?.meta?.fallback || null
    };

    const [result] = await db.query(
      `
        INSERT INTO chat_query_events (
          feature, question, question_norm, question_hash, lang,
          outcome, confidence, top_score, reason, source,
          session_id, user_key, meta
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        'site_guide',
        String(question).slice(0, 4000),
        questionNorm,
        hashQuestion(questionNorm),
        lang === 'en' ? 'en' : 'sr',
        classified.outcome,
        classified.confidence,
        topScore,
        classified.reason ? String(classified.reason).slice(0, 64) : null,
        classified.source ? String(classified.source).slice(0, 64) : null,
        sessionId ? String(sessionId).slice(0, 64) : null,
        userKey ? String(userKey).slice(0, 64) : null,
        JSON.stringify(meta)
      ]
    );

    return { id: result.insertId, outcome: classified.outcome };
  } catch (err) {
    console.error('[chatAnalytics] recordSiteGuideQuery failed:', err.message);
    return null;
  }
}

async function getTopQueries({ days = 30, limit = 20 } = {}) {
  const d = parseDays(days);
  const lim = parseLimit(limit);
  const [rows] = await db.query(
    `
      SELECT
        question_hash,
        MIN(question_norm) AS question_norm,
        SUBSTRING_INDEX(GROUP_CONCAT(question ORDER BY created_at DESC SEPARATOR '\n'), '\n', 1) AS sample_question,
        COUNT(*) AS ask_count,
        SUM(outcome = 'hit') AS hit_count,
        SUM(outcome = 'miss') AS miss_count,
        SUM(outcome = 'fallback') AS fallback_count,
        AVG(confidence) AS avg_confidence,
        MAX(created_at) AS last_asked_at,
        SUBSTRING_INDEX(GROUP_CONCAT(outcome ORDER BY created_at DESC, id DESC SEPARATOR ','), ',', 1) AS latest_outcome
      FROM chat_query_events
      WHERE created_at >= (NOW() - INTERVAL ? DAY)
        AND outcome IN ('hit', 'miss', 'fallback')
      GROUP BY question_hash
      ORDER BY ask_count DESC, last_asked_at DESC
      LIMIT ?
    `,
    [d, lim]
  );
  return rows;
}

/**
 * Open knowledge gaps only: a miss that was later answered (hit) for the same
 * question_hash drops off this list so CMS "Bez odgovora" stays actionable.
 * A new miss after that hit brings it back.
 */
async function getMissQueries({ days = 30, limit = 20 } = {}) {
  const d = parseDays(days);
  const lim = parseLimit(limit);
  const [rows] = await db.query(
    `
      SELECT
        question_hash,
        MIN(question_norm) AS question_norm,
        SUBSTRING_INDEX(GROUP_CONCAT(question ORDER BY created_at DESC SEPARATOR '\n'), '\n', 1) AS sample_question,
        COUNT(*) AS miss_count,
        AVG(confidence) AS avg_confidence,
        SUBSTRING_INDEX(GROUP_CONCAT(reason ORDER BY created_at DESC SEPARATOR '\n'), '\n', 1) AS last_reason,
        SUBSTRING_INDEX(GROUP_CONCAT(source ORDER BY created_at DESC SEPARATOR '\n'), '\n', 1) AS last_source,
        MAX(created_at) AS last_asked_at
      FROM chat_query_events q
      WHERE q.created_at >= (NOW() - INTERVAL ? DAY)
        AND q.outcome = 'miss'
        AND NOT EXISTS (
          SELECT 1
            FROM chat_query_events h
           WHERE h.question_hash = q.question_hash
             AND h.outcome = 'hit'
             AND h.created_at >= q.created_at
             AND h.created_at >= (NOW() - INTERVAL ? DAY)
        )
      GROUP BY question_hash
      ORDER BY miss_count DESC, last_asked_at DESC
      LIMIT ?
    `,
    [d, d, lim]
  );
  return rows;
}

async function getAnalyticsSummary({ days = 30 } = {}) {
  const d = parseDays(days);
  const [[totals], [openMiss]] = await Promise.all([
    db.query(
      `
        SELECT
          COUNT(*) AS total,
          SUM(outcome = 'hit') AS hits,
          SUM(outcome = 'miss') AS misses,
          SUM(outcome = 'fallback') AS fallbacks,
          SUM(outcome = 'skip') AS skips
        FROM chat_query_events
        WHERE created_at >= (NOW() - INTERVAL ? DAY)
      `,
      [d]
    ),
    db.query(
      `
        SELECT COUNT(DISTINCT q.question_hash) AS open_misses
        FROM chat_query_events q
        WHERE q.created_at >= (NOW() - INTERVAL ? DAY)
          AND q.outcome = 'miss'
          AND NOT EXISTS (
            SELECT 1
              FROM chat_query_events h
             WHERE h.question_hash = q.question_hash
               AND h.outcome = 'hit'
               AND h.created_at >= q.created_at
               AND h.created_at >= (NOW() - INTERVAL ? DAY)
          )
      `,
      [d, d]
    ),
  ]);
  const base = totals[0] || { total: 0, hits: 0, misses: 0, fallbacks: 0, skips: 0 };
  return {
    ...base,
    open_misses: Number(openMiss[0]?.open_misses) || 0,
  };
}

module.exports = {
  normalizeQuestion,
  hashQuestion,
  classifySiteGuideTurn,
  recordSiteGuideQuery,
  getTopQueries,
  getMissQueries,
  getAnalyticsSummary,
  missConfidenceMax,
  parseDays,
  parseLimit,
  _internal: {
    SKIP_SOURCES,
    DEFAULT_MISS_CONFIDENCE_MAX
  }
};
