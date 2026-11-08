const { normalizeJsonArray } = require('../jsonArray');

describe('normalizeJsonArray', () => {
  test('returns [] for empty values', () => {
    expect(normalizeJsonArray(null)).toEqual([]);
    expect(normalizeJsonArray(undefined)).toEqual([]);
    expect(normalizeJsonArray('')).toEqual([]);
  });

  test('passes through arrays', () => {
    expect(normalizeJsonArray(['wifi', 'tv'])).toEqual(['wifi', 'tv']);
  });

  test('parses JSON array strings', () => {
    expect(normalizeJsonArray('["wifi","parking"]')).toEqual(['wifi', 'parking']);
  });

  test('returns [] for non-array JSON', () => {
    expect(normalizeJsonArray('{"a":1}')).toEqual([]);
    expect(normalizeJsonArray('not-json')).toEqual([]);
  });
});
