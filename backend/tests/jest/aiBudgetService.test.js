'use strict';

// aiBudgetService.test.js
// Exercises assertBudget / recordSpend / getUsageSnapshot against an
// in-memory fake of ../db. No MySQL / network calls are performed.
//
// Because aiBudgetService reads AI_*_BUDGET_EUR at module-load time, each
// test calls jest.resetModules() + sets env + jest.doMock('../../db') +
// requires the module fresh.

function makeFakeDb(initialRows = []) {
  const rows = [...initialRows];
  const conn = {
    beginTransaction: jest.fn(async () => {}),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    release: jest.fn(() => {}),
    query: jest.fn(async (sql, params) => {
      // SELECT single eur_spent row (FOR UPDATE in assertBudget).
      if (sql.includes('SELECT eur_spent FROM ai_budget_monthly')) {
        const [mk, uk, f] = params;
        const r = rows.find(
          (x) => x.month_key === mk && x.user_key === uk && x.feature === f
        );
        return [r ? [{ eur_spent: r.eur_spent }] : [], []];
      }
      // Aggregate SUM(eur_spent)+SUM(request_count) over one user_key (snapshot).
      if (
        sql.includes(
          'SELECT SUM(eur_spent) AS eur_spent, SUM(request_count) AS request_count'
        )
      ) {
        const [mk, uk] = params;
        const filtered = rows.filter(
          (x) => x.month_key === mk && x.user_key === uk
        );
        const eur = filtered.reduce(
          (a, r) => a + Number(r.eur_spent || 0),
          0
        );
        const req = filtered.reduce(
          (a, r) => a + Number(r.request_count || 0),
          0
        );
        return [[{ eur_spent: eur, request_count: req }], []];
      }
      // SUM(eur_spent) AS total, used by recordSpend to report back.
      if (sql.includes('SUM(eur_spent) AS total')) {
        const [mk, uk] = params;
        const total = rows
          .filter((x) => x.month_key === mk && x.user_key === uk)
          .reduce((a, r) => a + Number(r.eur_spent || 0), 0);
        return [[{ total }], []];
      }
      // Top-users grouped select.
      if (sql.includes('GROUP BY user_key')) {
        const [mk, uk] = params;
        const grouped = {};
        for (const r of rows) {
          if (r.month_key === mk && r.user_key !== uk) {
            grouped[r.user_key] = grouped[r.user_key] || {
              user_key: r.user_key,
              eur_spent: 0,
              request_count: 0,
            };
            grouped[r.user_key].eur_spent += Number(r.eur_spent || 0);
            grouped[r.user_key].request_count += Number(r.request_count || 0);
          }
        }
        const out = Object.values(grouped)
          .sort((a, b) => b.eur_spent - a.eur_spent)
          .slice(0, 10);
        return [out, []];
      }
      // INSERT ... ON DUPLICATE KEY UPDATE.
      if (sql.includes('INSERT INTO ai_budget_monthly')) {
        const [mk, uk, f, ti, to_, eur] = params;
        const existing = rows.find(
          (r) => r.month_key === mk && r.user_key === uk && r.feature === f
        );
        if (existing) {
          existing.tokens_input =
            Number(existing.tokens_input || 0) + Number(ti);
          existing.tokens_output =
            Number(existing.tokens_output || 0) + Number(to_);
          existing.eur_spent =
            Number(existing.eur_spent || 0) + Number(eur);
          existing.request_count =
            Number(existing.request_count || 0) + 1;
        } else {
          rows.push({
            month_key: mk,
            user_key: uk,
            feature: f,
            tokens_input: Number(ti),
            tokens_output: Number(to_),
            eur_spent: Number(eur),
            request_count: 1,
          });
        }
        return [{ affectedRows: 1 }, []];
      }
      throw new Error('Unknown SQL in fake: ' + sql);
    }),
  };
  return {
    getConnection: jest.fn(async () => conn),
    query: jest.fn(async (sql, params) => conn.query(sql, params)),
    _rows: rows,
    _conn: conn,
  };
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

let originalEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
  jest.resetModules();
});

afterEach(() => {
  process.env = originalEnv;
  jest.resetModules();
});

describe('assertBudget', () => {
  it('passes when no rows exist', async () => {
    const fakeDb = makeFakeDb();
    jest.doMock('../../db', () => fakeDb);

    const { assertBudget } = require('../../services/aiBudgetService');
    await expect(
      assertBudget({ userKey: 'guest:1', feature: 'site_guide' })
    ).resolves.toBeUndefined();

    expect(fakeDb._conn.beginTransaction).toHaveBeenCalled();
    expect(fakeDb._conn.commit).toHaveBeenCalled();
    expect(fakeDb._conn.release).toHaveBeenCalled();
  });

  it('throws BudgetExceededError with code="BUDGET_EXCEEDED_USER" when user spend >= cap', async () => {
    process.env.AI_USER_MONTHLY_BUDGET_EUR = '2';
    process.env.AI_MONTHLY_BUDGET_EUR = '20';
    const mk = currentMonthKey();
    const fakeDb = makeFakeDb([
      {
        month_key: mk,
        user_key: 'guest:1',
        feature: 'site_guide',
        eur_spent: 2,
        request_count: 5,
        tokens_input: 100,
        tokens_output: 50,
      },
    ]);
    jest.doMock('../../db', () => fakeDb);

    const {
      assertBudget,
      BudgetExceededError,
    } = require('../../services/aiBudgetService');

    let caught;
    try {
      await assertBudget({ userKey: 'guest:1', feature: 'site_guide' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BudgetExceededError);
    expect(caught.code).toBe('BUDGET_EXCEEDED_USER');
    expect(fakeDb._conn.rollback).toHaveBeenCalled();
  });

  it('throws BudgetExceededError with code="BUDGET_EXCEEDED_GLOBAL" before checking the user row', async () => {
    process.env.AI_USER_MONTHLY_BUDGET_EUR = '2';
    process.env.AI_MONTHLY_BUDGET_EUR = '20';
    const mk = currentMonthKey();
    const fakeDb = makeFakeDb([
      {
        month_key: mk,
        user_key: '__global__',
        feature: 'site_guide',
        eur_spent: 20,
        request_count: 50,
        tokens_input: 1,
        tokens_output: 1,
      },
    ]);
    jest.doMock('../../db', () => fakeDb);

    const {
      assertBudget,
      BudgetExceededError,
    } = require('../../services/aiBudgetService');

    let caught;
    try {
      await assertBudget({ userKey: 'guest:1', feature: 'site_guide' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BudgetExceededError);
    expect(caught.code).toBe('BUDGET_EXCEEDED_GLOBAL');
  });
});

describe('recordSpend', () => {
  it('writes a user row and a global row with request_count=1 and eur_spent > 0', async () => {
    const fakeDb = makeFakeDb();
    jest.doMock('../../db', () => fakeDb);

    const { recordSpend } = require('../../services/aiBudgetService');

    const out = await recordSpend({
      userKey: 'guest:1',
      feature: 'site_guide',
      model: 'claude-sonnet-4-6',
      tokensIn: 1000,
      tokensOut: 500,
    });

    expect(out).toHaveProperty('eurDelta');
    expect(out).toHaveProperty('totalEurThisMonth');
    expect(out.eurDelta).toBeGreaterThan(0);

    expect(fakeDb._rows.length).toBe(2);
    const mk = currentMonthKey();
    for (const r of fakeDb._rows) {
      expect(r.month_key).toBe(mk);
      expect(r.feature).toBe('site_guide');
      expect(r.request_count).toBe(1);
      expect(r.eur_spent).toBeGreaterThan(0);
    }
    const keys = fakeDb._rows.map((r) => r.user_key).sort();
    expect(keys).toEqual(['__global__', 'guest:1']);
  });

  it('increments existing user + global rows (request_count goes 2 → 3, eur_spent rises)', async () => {
    const mk = currentMonthKey();
    const fakeDb = makeFakeDb([
      {
        month_key: mk,
        user_key: 'guest:1',
        feature: 'site_guide',
        eur_spent: 0.01,
        request_count: 2,
        tokens_input: 100,
        tokens_output: 50,
      },
      {
        month_key: mk,
        user_key: '__global__',
        feature: 'site_guide',
        eur_spent: 0.01,
        request_count: 2,
        tokens_input: 100,
        tokens_output: 50,
      },
    ]);
    jest.doMock('../../db', () => fakeDb);

    const { recordSpend } = require('../../services/aiBudgetService');

    await recordSpend({
      userKey: 'guest:1',
      feature: 'site_guide',
      model: 'claude-sonnet-4-6',
      tokensIn: 1000,
      tokensOut: 500,
    });

    expect(fakeDb._rows.length).toBe(2);
    for (const r of fakeDb._rows) {
      expect(r.request_count).toBe(3);
      expect(r.eur_spent).toBeGreaterThan(0.01);
    }
  });
});

describe('getUsageSnapshot', () => {
  it('returns the expected shape with monthKey, caps, spent, and topUsers', async () => {
    process.env.AI_USER_MONTHLY_BUDGET_EUR = '2';
    process.env.AI_MONTHLY_BUDGET_EUR = '20';
    const mk = currentMonthKey();
    const fakeDb = makeFakeDb([
      {
        month_key: mk,
        user_key: '__global__',
        feature: 'site_guide',
        eur_spent: 1,
        request_count: 3,
        tokens_input: 100,
        tokens_output: 50,
      },
      {
        month_key: mk,
        user_key: 'guest:1',
        feature: 'site_guide',
        eur_spent: 0.8,
        request_count: 2,
        tokens_input: 80,
        tokens_output: 40,
      },
      {
        month_key: mk,
        user_key: 'guest:2',
        feature: 'site_guide',
        eur_spent: 0.2,
        request_count: 1,
        tokens_input: 20,
        tokens_output: 10,
      },
    ]);
    jest.doMock('../../db', () => fakeDb);

    const {
      getUsageSnapshot,
    } = require('../../services/aiBudgetService');

    const snap = await getUsageSnapshot();

    expect(typeof snap.monthKey).toBe('string');
    expect(snap.monthKey).toMatch(/^\d{4}-\d{2}$/);
    expect(snap.caps.globalEur).toBe(20);
    expect(snap.caps.userEur).toBe(2);
    expect(snap.spent.globalEur).toBe(1);
    expect(typeof snap.spent.globalPercent).toBe('number');
    expect(snap.spent.todayEur).toBeNull();
    expect(snap.spent.requestCount).toBe(3);
    expect(Array.isArray(snap.topUsers)).toBe(true);
    expect(snap.topUsers.length).toBe(2);
    for (const u of snap.topUsers) {
      expect(u).toHaveProperty('userKey');
      expect(u).toHaveProperty('eurSpent');
      expect(u).toHaveProperty('requestCount');
    }
    // Sorted by eurSpent desc.
    expect(snap.topUsers[0].userKey).toBe('guest:1');
  });
});
