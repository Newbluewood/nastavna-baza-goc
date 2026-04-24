'use strict';

// retrieval-isolation.test.js
// Guard rail: the site-guide feature must NEVER touch the legacy
// `facts_collection` (used by the older aiService). We verify this three ways:
//   1. On the success path, searchInCollection is called with 'site_kb' and
//      the legacy searchFacts() mock is never invoked.
//   2. On the mock-mode fallback path, neither mock is invoked.
//   3. A static grep over siteGuideService.js source asserts neither
//      'facts_collection' nor 'searchFacts(' appears.

const fs = require('fs');
const path = require('path');

const {
  validateAssistantTurn,
} = require('../../services/assistantTurnSchema');

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

function installMocks() {
  const searchInCollectionMock = jest.fn(async () => [
    {
      id: 'r1',
      score: 0.7,
      payload: {
        kind: 'route',
        path: '/smestaj',
        sr: 'Smeštaj',
        en: 'Accommodation',
      },
    },
  ]);
  const searchFactsMock = jest.fn(async () => [{ id: 'x', score: 0.99 }]);
  jest.doMock('../../services/vectorSearchService', () => ({
    searchInCollection: searchInCollectionMock,
    searchFacts: searchFactsMock,
    upsertFact: jest.fn(),
    upsertInCollection: jest.fn(),
    ensureCollection: jest.fn(),
    getClient: jest.fn(),
    stringToNumericId: jest.fn(),
  }));

  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      content: [{ text: 'Kratak odgovor.' }],
      usage: { input_tokens: 3, output_tokens: 2 },
    }),
    text: async () => '',
  });
  jest.doMock('node-fetch', () => fetchMock);

  const recordSpendMock = jest
    .fn()
    .mockResolvedValue({ eurDelta: 0.001, totalEurThisMonth: 0.001 });
  jest.doMock('../../services/aiBudgetService', () => ({
    recordSpend: recordSpendMock,
    assertBudget: jest.fn().mockResolvedValue(undefined),
    getUsageSnapshot: jest.fn(),
    BudgetExceededError: class {},
  }));

  return { searchInCollectionMock, searchFactsMock, fetchMock, recordSpendMock };
}

describe('site-guide retrieval isolation - runtime', () => {
  it('success path calls searchInCollection with "site_kb" and never calls searchFacts', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_ENABLED = 'true';
    process.env.AI_API_KEY = 'test-key';

    const { searchInCollectionMock, searchFactsMock } = installMocks();

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'gde se nalazi smestaj?',
      lang: 'sr',
      userKey: 'guest:iso',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(searchInCollectionMock).toHaveBeenCalledTimes(1);
    expect(searchInCollectionMock.mock.calls[0][1]).toBe('site_kb');
    expect(searchFactsMock).not.toHaveBeenCalled();
  });

  it('mock-mode fallback path calls neither searchInCollection nor searchFacts', async () => {
    process.env.AI_PROVIDER = 'mock';

    const { searchInCollectionMock, searchFactsMock } = installMocks();

    const { composeSiteGuideTurn } = require('../../services/siteGuideService');
    const result = await composeSiteGuideTurn({
      message: 'test',
      lang: 'sr',
      userKey: 'guest:iso',
    });

    expect(() => validateAssistantTurn(result)).not.toThrow();
    expect(searchInCollectionMock).not.toHaveBeenCalled();
    expect(searchFactsMock).not.toHaveBeenCalled();
  });
});

describe('site-guide retrieval isolation - static source check', () => {
  it('siteGuideService.js does not reference facts_collection or searchFacts()', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../services/siteGuideService.js'),
      'utf8'
    );
    expect(src).not.toMatch(/facts_collection/);
    expect(src).not.toMatch(/searchFacts\s*\(/);
  });
});
