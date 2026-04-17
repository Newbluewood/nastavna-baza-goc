/**
 * Standardized HTTP response helpers.
 * All API responses flow through these to guarantee consistent shape.
 *
 * Success shape : { ok: true,  data: <payload> }
 * Error shape   : { ok: false, error: <message> }
 *
 * NOTE: Error responses intentionally preserve { error } at root level so
 * existing frontend code (`data.error`) continues to work without changes.
 */

/**
 * Send a 200 OK with a data payload.
 * @param {import('express').Response} res
 * @param {*} data
 */
function sendSuccess(res, data) {
  return res.json(data);
}

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {number} status  HTTP status code
 * @param {string} message Error message surfaced to the client
 */
function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

module.exports = { sendSuccess, sendError };
