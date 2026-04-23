// dateUtils.test.js
const { formatDate, isAfterDays, parseDate, addDays, isValidDate, daysBetween } = require('../dateUtils');

describe('dateUtils', () => {
  test('formatDate returns correct format', () => {
    expect(formatDate('2024-04-23')).toBe('23.04.2024');
  });

  test('isAfterDays returns true for future date', () => {
    const future = addDays(new Date(), 5);
    expect(isAfterDays(future, 3)).toBe(true);
  });

  test('isAfterDays returns false for past date', () => {
    const past = addDays(new Date(), -5);
    expect(isAfterDays(past, 3)).toBe(false);
  });

  test('parseDate returns Date object', () => {
    expect(parseDate('2024-04-23')).toBeInstanceOf(Date);
  });

  test('addDays adds days correctly', () => {
    const d = new Date('2024-04-23');
    expect(addDays(d, 2).getDate()).toBe(25);
  });

  test('isValidDate returns true for valid date', () => {
    expect(isValidDate('2024-04-23')).toBe(true);
  });

  test('isValidDate returns false for invalid date', () => {
    expect(isValidDate('not-a-date')).toBe(false);
  });

  test('daysBetween returns correct diff', () => {
    expect(daysBetween('2024-04-23', '2024-04-25')).toBe(2);
  });
});
