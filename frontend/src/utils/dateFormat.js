/**
 * Shared date formatting utilities for the frontend.
 * Eliminates duplicated fmt/formatDate/daysUntil across views.
 */

/**
 * Format a date string to Serbian locale (dd.mm.yyyy).
 * @param {string|null} dateStr - ISO date string or YYYY-MM-DD
 * @returns {string}
 */
export function fmt(dateStr) {
  if (!dateStr) return '—'
  const normalized = String(dateStr).split('T')[0]
  return new Date(normalized + 'T12:00:00').toLocaleDateString('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/**
 * Calculate days until a given date from today.
 * @param {string|null} dateStr - YYYY-MM-DD
 * @returns {number|null}
 */
export function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

/**
 * Normalize a date input to YYYY-MM-DD string.
 * @param {string|Date|null} d
 * @returns {string|null}
 */
export function normalizeDate(d) {
  if (!d) return null
  const s = typeof d === 'string' ? d : d.toISOString()
  return s.split('T')[0]
}
