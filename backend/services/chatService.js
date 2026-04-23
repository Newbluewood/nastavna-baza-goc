const db = require('../db');

/**
 * Store a chat message in the database.
 * @param {Object} opts
 * @param {number|null} opts.guest_id
 * @param {string} opts.role - 'user' or 'assistant'
 * @param {string} opts.message
 * @param {string|null} opts.session_id
 * @param {Object|null} opts.meta
 * @returns {Promise<object>} Inserted message row
 */
async function saveChatMessage({ guest_id = null, role, message, session_id = null, meta = null }) {
  const [result] = await db.query(
    `INSERT INTO chat_messages (guest_id, role, message, session_id, meta) VALUES (?, ?, ?, ?, ?)`,
    [guest_id, role, message, session_id, meta ? JSON.stringify(meta) : null]
  );
  return { id: result.insertId, guest_id, role, message, session_id, meta };
}

/**
 * Get chat messages for a user (optionally by session).
 * @param {number} guest_id
 * @param {string|null} session_id
 * @param {number} [limit=100]
 * @returns {Promise<Array>}
 */
async function getChatMessages(guest_id, session_id = null, limit = 100) {
  let sql = `SELECT * FROM chat_messages WHERE guest_id = ?`;
  const params = [guest_id];
  if (session_id) {
    sql += ' AND session_id = ?';
    params.push(session_id);
  }
  sql += ' ORDER BY created_at ASC LIMIT ?';
  params.push(limit);
  const [rows] = await db.query(sql, params);
  return rows;
}

module.exports = { saveChatMessage, getChatMessages };