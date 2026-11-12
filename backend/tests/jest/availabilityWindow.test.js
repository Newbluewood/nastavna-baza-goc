const { getDefaultAvailabilityWindow } = require('../../utils/availabilityWindow');

describe('getDefaultAvailabilityWindow', () => {
  const prevPast = process.env.AVAILABILITY_PAST_DAYS;
  const prevFuture = process.env.AVAILABILITY_FUTURE_MONTHS;

  afterEach(() => {
    if (prevPast === undefined) delete process.env.AVAILABILITY_PAST_DAYS;
    else process.env.AVAILABILITY_PAST_DAYS = prevPast;
    if (prevFuture === undefined) delete process.env.AVAILABILITY_FUTURE_MONTHS;
    else process.env.AVAILABILITY_FUTURE_MONTHS = prevFuture;
  });

  test('defaults to 7 past days and 18 future months', () => {
    delete process.env.AVAILABILITY_PAST_DAYS;
    delete process.env.AVAILABILITY_FUTURE_MONTHS;
    const now = new Date(Date.UTC(2026, 10, 12)); // 2026-11-12
    const window = getDefaultAvailabilityWindow(now);
    expect(window.windowStart).toBe('2026-11-05');
    expect(window.windowEnd).toBe('2028-05-12');
    expect(window.pastDays).toBe(7);
    expect(window.futureMonths).toBe(18);
  });

  test('respects env overrides', () => {
    process.env.AVAILABILITY_PAST_DAYS = '1';
    process.env.AVAILABILITY_FUTURE_MONTHS = '2';
    const now = new Date(Date.UTC(2026, 0, 15));
    const window = getDefaultAvailabilityWindow(now);
    expect(window.windowStart).toBe('2026-01-14');
    expect(window.windowEnd).toBe('2026-03-15');
  });
});
