/**
 * aiBudgetService.js
 * Monetary budget enforcement for AI features.
 *
 * Backing store: `ai_budget_monthly` table (see backend/migrateDb.js).
 *   - Per (month_key, user_key, feature) row tracks user spend.
 *   - A sentinel row with user_key='__global__' aggregates monthly spend across all users.
 *
 * Env:
 *   AI_MONTHLY_BUDGET_EUR       - hard cap across all users per month (default 20 EUR)
 *   AI_USER_MONTHLY_BUDGET_EUR  - hard cap per individual user per month (default 2 EUR)
 */

const db = require('../db');
const aiPricing = require('../config/aiPricing');

const GLOBAL_USER_KEY = '__global__';

function toPositiveFloat(v, fallback) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const CAP_GLOBAL_EUR = toPositiveFloat(process.env.AI_MONTHLY_BUDGET_EUR, 20);
const CAP_USER_EUR = toPositiveFloat(process.env.AI_USER_MONTHLY_BUDGET_EUR, 2);

function currentMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

class BudgetExceededError extends Error {
  constructor(message, { code, userKey, feature, limitEur, spentEur }) {
    super(message);
    this.name = 'BudgetExceededError';
    this.code = code;
    this.userKey = userKey;
    this.feature = feature;
    this.limitEur = limitEur;
    this.spentEur = spentEur;
  }
}

/**
 * Ensure request is within budget. Uses MySQL SELECT FOR UPDATE inside a transaction for atomicity.
 * Throws BudgetExceededError(code:'BUDGET_EXCEEDED_USER'|'BUDGET_EXCEEDED_GLOBAL') if exceeded.
 *
 * @param {object} p
 * @param {string} p.userKey - e.g. 'guest:123' or 'ip:1.2.3.4' or 'anon'
 * @param {string} p.feature - e.g. 'site_guide'
 * @returns {Promise<void>}
 */
async function assertBudget({ userKey, feature }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const monthKey = currentMonthKey();

    const [userRows] = await conn.query(
      'SELECT eur_spent FROM ai_budget_monthly WHERE month_key=? AND user_key=? AND feature=? FOR UPDATE',
      [monthKey, userKey, feature]
    );
    const [globalRows] = await conn.query(
      'SELECT eur_spent FROM ai_budget_monthly WHERE month_key=? AND user_key=? AND feature=? FOR UPDATE',
      [monthKey, GLOBAL_USER_KEY, feature]
    );

    const userEur = userRows[0] && userRows[0].eur_spent != null ? Number(userRows[0].eur_spent) : 0;
    const globalEur = globalRows[0] && globalRows[0].eur_spent != null ? Number(globalRows[0].eur_spent) : 0;

    if (globalEur >= CAP_GLOBAL_EUR) {
      throw new BudgetExceededError('Global AI monthly budget exceeded', {
        code: 'BUDGET_EXCEEDED_GLOBAL',
        userKey,
        feature,
        limitEur: CAP_GLOBAL_EUR,
        spentEur: globalEur
      });
    }
    if (userEur >= CAP_USER_EUR) {
      throw new BudgetExceededError('User AI monthly budget exceeded', {
        code: 'BUDGET_EXCEEDED_USER',
        userKey,
        feature,
        limitEur: CAP_USER_EUR,
        spentEur: userEur
      });
    }

    await conn.commit();
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* noop */ }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Record actual spend after LLM call completes successfully.
 * Uses INSERT ... ON DUPLICATE KEY UPDATE for both the user row and the global row.
 *
 * @param {object} p
 * @param {string} p.userKey
 * @param {string} p.feature
 * @param {string} p.model - pricing table key
 * @param {number} p.tokensIn
 * @param {number} p.tokensOut
 * @returns {Promise<{ eurDelta:number, totalEurThisMonth:number }>}
 */
async function recordSpend({ userKey, feature, model, tokensIn, tokensOut }) {
  const safeIn = Number.isFinite(Number(tokensIn)) ? Number(tokensIn) : 0;
  const safeOut = Number.isFinite(Number(tokensOut)) ? Number(tokensOut) : 0;
  const eurDelta = aiPricing.tokensToEur({ model, tokensIn: safeIn, tokensOut: safeOut });
  const monthKey = currentMonthKey();

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const sql = `INSERT INTO ai_budget_monthly
      (month_key, user_key, feature, tokens_input, tokens_output, eur_spent, request_count)
      VALUES (?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        tokens_input = tokens_input + VALUES(tokens_input),
        tokens_output = tokens_output + VALUES(tokens_output),
        eur_spent = eur_spent + VALUES(eur_spent),
        request_count = request_count + 1`;

    await conn.query(sql, [monthKey, userKey, feature, safeIn, safeOut, eurDelta]);
    await conn.query(sql, [monthKey, GLOBAL_USER_KEY, feature, safeIn, safeOut, eurDelta]);

    await conn.commit();

    const [rows] = await conn.query(
      'SELECT SUM(eur_spent) AS total FROM ai_budget_monthly WHERE month_key=? AND user_key=?',
      [monthKey, GLOBAL_USER_KEY]
    );
    const totalEurThisMonth = rows[0] && rows[0].total != null ? Number(rows[0].total) : eurDelta;

    return { eurDelta, totalEurThisMonth };
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* noop */ }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Snapshot for the admin dashboard. Reads current month only.
 *
 * @returns {Promise<{
 *   monthKey: string,
 *   caps: { globalEur: number, userEur: number },
 *   spent: { globalEur: number, globalPercent: number, todayEur: (number|null), requestCount: number },
 *   topUsers: Array<{ userKey: string, eurSpent: number, requestCount: number }>
 * }>}
 */
async function getUsageSnapshot() {
  const monthKey = currentMonthKey();

  const [globalRows] = await db.query(
    `SELECT SUM(eur_spent) AS eur_spent, SUM(request_count) AS request_count
       FROM ai_budget_monthly
      WHERE month_key=? AND user_key=?`,
    [monthKey, GLOBAL_USER_KEY]
  );
  const globalEur = globalRows[0] && globalRows[0].eur_spent != null ? Number(globalRows[0].eur_spent) : 0;
  const requestCount = globalRows[0] && globalRows[0].request_count != null ? Number(globalRows[0].request_count) : 0;

  const [users] = await db.query(
    `SELECT user_key, SUM(eur_spent) AS eur_spent, SUM(request_count) AS request_count
       FROM ai_budget_monthly
      WHERE month_key=? AND user_key <> ?
      GROUP BY user_key
      ORDER BY eur_spent DESC
      LIMIT 10`,
    [monthKey, GLOBAL_USER_KEY]
  );

  return {
    monthKey,
    caps: { globalEur: CAP_GLOBAL_EUR, userEur: CAP_USER_EUR },
    spent: {
      globalEur,
      globalPercent: CAP_GLOBAL_EUR > 0 ? Number(((globalEur / CAP_GLOBAL_EUR) * 100).toFixed(2)) : 0,
      // Daily granularity is not tracked in this MVP; signal unavailable.
      todayEur: null,
      requestCount
    },
    topUsers: users.map((u) => ({
      userKey: u.user_key,
      eurSpent: Number(u.eur_spent),
      requestCount: Number(u.request_count)
    }))
  };
}

module.exports = {
  assertBudget,
  recordSpend,
  getUsageSnapshot,
  BudgetExceededError
};
