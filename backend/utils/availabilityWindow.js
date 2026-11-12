/**
 * Default calendar window for public room availability dumps
 * (GET without start/end). Keeps InquiryModal usable without returning
 * the entire reservation history.
 */
function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatDateOnly(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @param {Date} [now]
 * @returns {{ windowStart: string, windowEnd: string, pastDays: number, futureMonths: number }}
 */
function getDefaultAvailabilityWindow(now = new Date()) {
  const pastDays = toPositiveInt(process.env.AVAILABILITY_PAST_DAYS, 7);
  const futureMonths = toPositiveInt(process.env.AVAILABILITY_FUTURE_MONTHS, 18);

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - pastDays);

  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  end.setUTCMonth(end.getUTCMonth() + futureMonths);

  return {
    windowStart: formatDateOnly(start),
    windowEnd: formatDateOnly(end),
    pastDays,
    futureMonths,
  };
}

module.exports = {
  getDefaultAvailabilityWindow,
  formatDateOnly,
};
