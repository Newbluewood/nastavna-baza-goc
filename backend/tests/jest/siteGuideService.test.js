'use strict';

// siteGuideService.test.js
// Covers composeSiteGuideTurn's resilience ladder (mock mode → vector failure →
// no hits → Claude non-200 → success → swallowed recordSpend failure →
// missing API key). All external deps (node-fetch, vectorSearchService,
// aiBudgetService) are stubbed via jest.doMock *before* requiring the module
// under test, so no real network / DB / Qdrant calls can happen.

const {
  validateAssistantTurn,
} = require('../../services/assistantTurnSchema');

const SAMPLE_HIT = {
  id: 'r1',
  score: 0.8,
  payload: {
    kind: 'route',
    path: '/smestaj',
    sr: 'Smeštaj',
    en: 'Accommodation',
  },
};

let originalEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
  jest.resetModules();
});

afterEach(() => {
  process.env = originalEnv;
  jest.resetModules();
  jest.restoreAllMocks();
});

/**
 * Register shared jest.doMock stubs and return handles so each test can
 * customize behavior before requiring siteGuideService.
 */
function setupMocks({ fetchMock, searchMock, recordSpendMock } = {}) {
  const fetchFn =
    fetchMock ||
    jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        content: [{ text: 'ok' }],
        usage: { input_tokens: 0, output_tokens: 0 },
      }),
      text: async () => 'ok',
    });

  const searchInCollection = searchMock || jest.fn().mockResolvedValue([]);
  const recordSpend =
    recordSpendMock ||
    jest
      .fn()
      .mockResolvedValue({ eurDelta: 0.01, totalEurThisMonth: 0.01 });

  jest.doMock('node-fetch', () => fetchFn);
  jest.doMock('../../services/vectorSearchService', () => ({
    searchInCollection,
    searchFacts: jest.fn(),
    upsertFact: jest.fn(),
    upsertInCollection: jest.fn(),
    ensureCollection: jest.fn(),
    getClient: jest.fn(),
    stringToNumericId: jest.fn(),
  }));
  jest.doMock('../../services/aiBudgetService', () => ({
    recordSpend,
    assertBudget: jest.fn().mockResolvedValue(undefined),
    getUsageSnapshot: jest.fn(),
    BudgetExceededError: class {},
  }));

  return { fetchFn, searchInCollection, recordSpend };
}

function setupDbMock({ attractions = [], facilities = [], roomsAgg = [], news = [] } = {}) {
  const dbQuery = jest.fn(async (sql) => {
    if (sql.includes('FROM attractions')) return [attractions];
    if (sql.includes('FROM facilities')) return [facilities];
    if (sql.includes('FROM rooms')) return [roomsAgg];
    if (sql.includes('FROM news')) return [news];
    return [[]];
  });
  jest.doMock('../../db', () => ({ query: dbQuery }));
  return { dbQuery };
}

describe('composeSiteGuideTurn - disabled / mock paths', () => {
  it('returns hiking DB facts for walking-style question before RAG path', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_ENABLED = 'true';
    process.env.AI_API_KEY = 'test-key';
    const { fetchFn, searchInCollection } = setupMocks();
    const dbQuery = jest.fn(async (sql) => {
      if (sql.includes('FROM attractions')) {
        return [[
          { id: 1, name: 'Vidikovac Krst', description: 'Staza kroz šumu', distance_km: 2.5, distance_minutes: 40 },
          { id: 2, name: 'Šumska staza Studenac', description: 'Lagana šetnja', distance_km: 1.8, distance_minutes: 30 },
        ]];
      }
      return [[]];
    });
    jest.doMock('../../db', () => ({ query: dbQuery }));

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'volim da pesacim, sta ima tamo za mene',
      lang: 'sr',
      userKey: 'anon',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(result.meta.source).toBe('db_hiking_facts');
    expect(result.answer).toMatch(/pešačenje|pesacenje|pešačenje/i);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(searchInCollection).not.toHaveBeenCalled();
  });

  it('returns a keyword fallback with reason="ai_disabled_or_mock" when AI_PROVIDER=mock', async () => {
    process.env.AI_PROVIDER = 'mock';
    const { fetchFn, searchInCollection } = setupMocks();

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'test',
      lang: 'sr',
      userKey: 'anon',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(['site_guide', 'unknown']).toContain(result.intent);
    expect(result.meta.reason).toBe('ai_disabled_or_mock');
    expect(fetchFn).not.toHaveBeenCalled();
    expect(searchInCollection).not.toHaveBeenCalled();
  });

  it('returns a keyword fallback with reason="ai_disabled_or_mock" when AI_ENABLED=false', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_ENABLED = 'false';
    const { fetchFn, searchInCollection } = setupMocks();

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'test',
      lang: 'sr',
      userKey: 'anon',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(['site_guide', 'unknown']).toContain(result.intent);
    expect(result.meta.reason).toBe('ai_disabled_or_mock');
    expect(fetchFn).not.toHaveBeenCalled();
    expect(searchInCollection).not.toHaveBeenCalled();
  });
});

describe('composeSiteGuideTurn - DB facts routing', () => {
  it('returns event facts from DB for event-style question', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_ENABLED = 'true';
    process.env.AI_API_KEY = 'test-key';
    const { fetchFn, searchInCollection } = setupMocks();
    setupDbMock({
      news: [
        { id: 1, title: 'Akcija ciscenja staza', created_at: '2026-04-01' },
        { id: 2, title: 'Radionica u bazi', created_at: '2026-03-30' },
      ],
    });

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'ima li neki event skoro',
      lang: 'sr',
      userKey: 'anon',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(result.meta.source).toBe('db_news_facts');
    expect(result.answer).toMatch(/Akcija ciscenja staza|Radionica u bazi/i);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(searchInCollection).not.toHaveBeenCalled();
  });

  it('returns event facts with content when user asks what news says', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_ENABLED = 'true';
    process.env.AI_API_KEY = 'test-key';
    const { fetchFn, searchInCollection } = setupMocks();
    setupDbMock({
      news: [
        { id: 10, title: 'Terenska nastava', excerpt: 'Studenti su danas imali terensku nastavu na stazi.', content: '', created_at: '2026-04-10' },
      ],
    });

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'ali ne znas sta pise u tim vestima',
      lang: 'sr',
      userKey: 'anon',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(result.meta.source).toBe('db_news_facts');
    expect(result.answer).toMatch(/Terenska nastava/i);
    expect(result.answer).toMatch(/Studenti su danas imali terensku nastavu/i);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(searchInCollection).not.toHaveBeenCalled();
  });

  it('returns humanized offer facts (no raw tags) for offer question', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_ENABLED = 'true';
    process.env.AI_API_KEY = 'test-key';
    const { fetchFn, searchInCollection } = setupMocks();
    setupDbMock({
      facilities: [
        { id: 1, name: 'Hotel', capacity: 0, capacity_min: 2, capacity_max: 4, stay_tags: '["group","restaurant","conference"]' },
      ],
      roomsAgg: [{ rooms: 5, min_cap: 2, max_cap: 4 }],
    });

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'sta je u ponudi smestaja',
      lang: 'sr',
      userKey: 'anon',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(result.meta.source).toBe('db_offer_facts');
    expect(result.answer).toMatch(/pogodno za grupe/i);
    expect(result.answer).toMatch(/restoran u objektu/i);
    expect(result.answer).not.toMatch(/\bgroup\b/i);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(searchInCollection).not.toHaveBeenCalled();
  });

  it('keeps date intent highest-priority over other intents', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_ENABLED = 'true';
    process.env.AI_API_KEY = 'test-key';
    const { fetchFn, searchInCollection } = setupMocks();
    setupDbMock({
      attractions: [{ id: 1, name: 'Staza', distance_km: 2, distance_minutes: 30 }],
      facilities: [{ id: 1, stay_tags: '["group"]' }],
      roomsAgg: [{ rooms: 3, min_cap: 2, max_cap: 4 }],
      news: [{ id: 1, title: 'Vest' }],
    });

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'koji je danas dan i sta ima za pesacenje',
      lang: 'sr',
      userKey: 'anon',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(result.meta.source).toBe('server_clock');
    expect(fetchFn).not.toHaveBeenCalled();
    expect(searchInCollection).not.toHaveBeenCalled();
  });
});

describe('composeSiteGuideTurn - RAG path failures', () => {
  it('falls back to keyword with reason="no_vector_hits" when searchInCollection rejects and static facts do not match', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_ENABLED = 'true';
    process.env.AI_API_KEY = 'test-key';
    // Silence expected error log.
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const { fetchFn } = setupMocks({
      searchMock: jest.fn().mockRejectedValue(new Error('qdrant down')),
    });

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'zzzxxyyqq',
      lang: 'sr',
      userKey: 'anon',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(result.meta.reason).toBe('no_vector_hits');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('uses static hits + Claude when vector search fails but static match exists', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_ENABLED = 'true';
    process.env.AI_API_KEY = 'test-key';
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        content: [{ text: 'Odgovor iz statickih cinjenica.' }],
        usage: { input_tokens: 20, output_tokens: 10 },
      }),
      text: async () => '',
    });
    const { searchInCollection } = setupMocks({
      fetchMock,
      searchMock: jest.fn().mockRejectedValue(new Error('qdrant down')),
    });

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'kontakt',
      lang: 'sr',
      userKey: 'anon',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(result.answer).toBe('Odgovor iz statickih cinjenica.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(searchInCollection).toHaveBeenCalledTimes(1);
  });

  it('falls back to keyword with reason="no_vector_hits" when search returns []', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_ENABLED = 'true';
    process.env.AI_API_KEY = 'test-key';

    const { fetchFn } = setupMocks({
      searchMock: jest.fn().mockResolvedValue([]),
    });

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'zzzxxyyqq',
      lang: 'sr',
      userKey: 'anon',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(result.meta.reason).toBe('no_vector_hits');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('falls back with reason="llm_call_failed" when Claude returns non-200 and never records spend', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_ENABLED = 'true';
    process.env.AI_API_KEY = 'test-key';
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'boom',
      json: async () => ({}),
    });
    const { recordSpend } = setupMocks({
      fetchMock,
      searchMock: jest.fn().mockResolvedValue([SAMPLE_HIT]),
    });

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'test',
      lang: 'sr',
      userKey: 'anon',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(result.meta.reason).toBe('llm_call_failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(recordSpend).not.toHaveBeenCalled();
  });

  it('falls back with reason="llm_call_failed" when AI_API_KEY is missing', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_ENABLED = 'true';
    delete process.env.AI_API_KEY;
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const { fetchFn, recordSpend } = setupMocks({
      searchMock: jest.fn().mockResolvedValue([SAMPLE_HIT]),
    });

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'test',
      lang: 'sr',
      userKey: 'anon',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(result.meta.reason).toBe('llm_call_failed');
    // fetch is never reached because callClaudeSiteGuide throws before it.
    expect(fetchFn).not.toHaveBeenCalled();
    expect(recordSpend).not.toHaveBeenCalled();
  });
});

describe('composeSiteGuideTurn - success path', () => {
  it('returns a validated site_guide turn, calls recordSpend and searches site_kb', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_ENABLED = 'true';
    process.env.AI_API_KEY = 'test-key';

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        content: [{ text: 'Kratak odgovor.' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
      text: async () => '',
    });
    const { searchInCollection, recordSpend } = setupMocks({
      fetchMock,
      searchMock: jest.fn().mockResolvedValue([SAMPLE_HIT]),
    });

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'test',
      lang: 'sr',
      userKey: 'guest:1',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(result.answer).toBe('Kratak odgovor.');
    expect(result.intent).toBe('site_guide');
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources[0].collection).toBe('site_kb');

    expect(recordSpend).toHaveBeenCalledTimes(1);
    expect(recordSpend).toHaveBeenCalledWith({
      userKey: 'guest:1',
      feature: 'site_guide',
      model: expect.any(String),
      tokensIn: 10,
      tokensOut: 5,
    });

    expect(searchInCollection).toHaveBeenCalledTimes(1);
    const call = searchInCollection.mock.calls[0];
    expect(typeof call[0]).toBe('string');
    expect(call[1]).toBe('site_kb');
    expect(call[2]).toBe(5);
  });

  it('swallows a failing recordSpend and still returns a valid turn', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_ENABLED = 'true';
    process.env.AI_API_KEY = 'test-key';
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        content: [{ text: 'Kratak odgovor.' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
      text: async () => '',
    });
    const recordSpendMock = jest
      .fn()
      .mockRejectedValue(new Error('db down'));
    setupMocks({
      fetchMock,
      searchMock: jest.fn().mockResolvedValue([SAMPLE_HIT]),
      recordSpendMock,
    });

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'test',
      lang: 'sr',
      userKey: 'guest:1',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(result.answer).toBe('Kratak odgovor.');
    expect(recordSpendMock).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalled();
  });
});
