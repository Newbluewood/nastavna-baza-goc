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

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapSpendRow(row) {
  const tokensInput = num(row.tokens_input);
  const tokensOutput = num(row.tokens_output);
  return {
    eurSpent: num(row.eur_spent),
    requestCount: num(row.request_count),
    tokensInput,
    tokensOutput,
    tokensTotal: tokensInput + tokensOutput
  };
}

const SPEND_SUM_SQL = `COALESCE(SUM(eur_spent), 0) AS eur_spent,
            COALESCE(SUM(request_count), 0) AS request_count,
            COALESCE(SUM(tokens_input), 0) AS tokens_input,
            COALESCE(SUM(tokens_output), 0) AS tokens_output`;

/**
 * Snapshot for the admin dashboard. Reads current month only.
 *
 * Totals come from real user rows (chat-agent UPSERTs per user_key / feature).
 * The `__global__` sentinel is only a fallback for older site-side writes.
 *
 * @returns {Promise<{
 *   monthKey: string,
 *   caps: { globalEur: number, userEur: number },
 *   spent: { globalEur: number, globalPercent: number, todayEur: (number|null), requestCount: number, tokensInput: number, tokensOutput: number, tokensTotal: number },
 *   byFeature: Array<{ feature: string, eurSpent: number, requestCount: number, tokensInput: number, tokensOutput: number, tokensTotal: number }>,
 *   topUsers: Array<{ userKey: string, eurSpent: number, requestCount: number, tokensInput: number, tokensOutput: number, tokensTotal: number }>,
 *   rows: Array<{ userKey: string, feature: string, eurSpent: number, requestCount: number, tokensInput: number, tokensOutput: number, tokensTotal: number, updatedAt: (string|null) }>
 * }>}
 */
async function getUsageSnapshot() {
  const monthKey = currentMonthKey();

  const [userAgg] = await db.query(
    `SELECT ${SPEND_SUM_SQL}
       FROM ai_budget_monthly
      WHERE month_key=? AND user_key <> ?`,
    [monthKey, GLOBAL_USER_KEY]
  );
  let totals = mapSpendRow(userAgg[0] || {});

  if (totals.eurSpent === 0 && totals.requestCount === 0 && totals.tokensInput === 0 && totals.tokensOutput === 0) {
    const [globalRows] = await db.query(
      `SELECT ${SPEND_SUM_SQL}
         FROM ai_budget_monthly
        WHERE month_key=? AND user_key=?`,
      [monthKey, GLOBAL_USER_KEY]
    );
    totals = mapSpendRow(globalRows[0] || {});
  }

  const [users] = await db.query(
    `SELECT user_key, ${SPEND_SUM_SQL}
       FROM ai_budget_monthly
      WHERE month_key=? AND user_key <> ?
      GROUP BY user_key
      ORDER BY eur_spent DESC
      LIMIT 50`,
    [monthKey, GLOBAL_USER_KEY]
  );

  const [features] = await db.query(
    `SELECT feature, ${SPEND_SUM_SQL}
       FROM ai_budget_monthly
      WHERE month_key=? AND user_key <> ?
      GROUP BY feature
      ORDER BY eur_spent DESC`,
    [monthKey, GLOBAL_USER_KEY]
  );

  const [detailRows] = await db.query(
    `SELECT user_key, feature, tokens_input, tokens_output, eur_spent, request_count, updated_at
       FROM ai_budget_monthly
      WHERE month_key=? AND user_key <> ?
      ORDER BY eur_spent DESC, request_count DESC
      LIMIT 100`,
    [monthKey, GLOBAL_USER_KEY]
  );

  return {
    monthKey,
    caps: { globalEur: CAP_GLOBAL_EUR, userEur: CAP_USER_EUR },
    spent: {
      globalEur: totals.eurSpent,
      globalPercent: CAP_GLOBAL_EUR > 0 ? Number(((totals.eurSpent / CAP_GLOBAL_EUR) * 100).toFixed(2)) : 0,
      tokensInput: totals.tokensInput,
      tokensOutput: totals.tokensOutput,
      tokensTotal: totals.tokensTotal,
      todayEur: null,
      requestCount: totals.requestCount
    },
    byFeature: features.map((f) => ({
      feature: f.feature,
      ...mapSpendRow(f)
    })),
    topUsers: users.map((u) => ({
      userKey: u.user_key,
      ...mapSpendRow(u)
    })),
    rows: detailRows.map((r) => ({
      userKey: r.user_key,
      feature: r.feature,
      updatedAt: r.updated_at || null,
      ...mapSpendRow(r)
    }))
  };
}

module.exports = {
  assertBudget,
  recordSpend,
  getUsageSnapshot,
  BudgetExceededError
};
