/**
 * Reject poisoned/cache-misshapen API bodies that arrive as HTTP 200
 * with only `{ error: "..." }` (seen after DB blips + response caching).
 */
export function assertApiPayload(data) {
  if (
    data
    && typeof data === 'object'
    && !Array.isArray(data)
    && typeof data.error === 'string'
    && Object.keys(data).length === 1
  ) {
    const err = new Error(data.error)
    err.status = 500
    err.data = data
    throw err
  }
  return data
}
