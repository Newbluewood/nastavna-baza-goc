/**
 * Normalize MySQL JSON / string / array fields into a plain array.
 */
function normalizeJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = { normalizeJsonArray };
