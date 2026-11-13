'use strict';

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const {
  normalizeQuestion,
  hashQuestion,
  classifySiteGuideTurn,
  missConfidenceMax,
  getMissQueries,
  getAnalyticsSummary,
} = require('../../services/chatAnalyticsService');

describe('chatAnalyticsService', () => {
  test('normalizeQuestion collapses case and punctuation', () => {
    expect(normalizeQuestion('  Da li je dozvoljen BORAVAK?! ')).toBe(
      'da li je dozvoljen boravak'
    );
  });

  test('hashQuestion is stable', () => {
    const a = hashQuestion('da li ima wifi');
    const b = hashQuestion('da li ima wifi');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  test('classifies greeting as skip', () => {
    const result = classifySiteGuideTurn({
      confidence: 1,
      meta: { source: 'greeting_turn' }
    });
    expect(result.outcome).toBe('skip');
  });

  test('classifies no_keyword_match as miss', () => {
    const result = classifySiteGuideTurn({
      confidence: 0.12,
      meta: { reason: 'no_vector_hits', fallback: 'no_keyword_match' }
    });
    expect(result.outcome).toBe('miss');
  });

  test('classifies low confidence as miss', () => {
    const result = classifySiteGuideTurn({
      confidence: Math.max(0, missConfidenceMax() - 0.01),
      meta: {}
    });
    expect(result.outcome).toBe('miss');
    expect(result.reason).toBe('low_confidence');
  });

  test('classifies keyword fallback with decent confidence as fallback', () => {
    const result = classifySiteGuideTurn({
      confidence: 0.4,
      meta: { reason: 'ai_disabled_or_mock', fallback: 'keyword' }
    });
    expect(result.outcome).toBe('fallback');
  });

  test('classifies rag turn as hit', () => {
    const result = classifySiteGuideTurn({
      confidence: 0.8,
      meta: { model: 'claude', hits: 3 }
    });
    expect(result.outcome).toBe('hit');
    expect(result.source).toBe('rag');
  });

  test('getMissQueries asks only for open misses (no later hit)', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await getMissQueries({ days: 30, limit: 10 });
    const sql = String(db.query.mock.calls[0][0]);
    expect(sql).toMatch(/NOT EXISTS/i);
    expect(sql).toMatch(/h\.outcome = 'hit'/);
    expect(sql).toMatch(/h\.created_at >= q\.created_at/);
  });

  test('getAnalyticsSummary includes open_misses', async () => {
    db.query
      .mockResolvedValueOnce([[{ total: 5, hits: 2, misses: 3, fallbacks: 0, skips: 0 }]])
      .mockResolvedValueOnce([[{ open_misses: 1 }]]);
    const summary = await getAnalyticsSummary({ days: 7 });
    expect(summary.open_misses).toBe(1);
    expect(summary.misses).toBe(3);
  });
});
