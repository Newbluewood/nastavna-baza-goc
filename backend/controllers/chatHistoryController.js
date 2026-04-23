const chatService = require('../services/chatService');

// POST /api/chat/history - Save a chat message
async function saveMessage(req, res) {
  const guest_id = req.user ? req.user.id : null;
  const { role, message, session_id, meta } = req.body;
  if (!role || !message) {
    return res.status(400).json({ error: 'role and message are required' });
  }
  const saved = await chatService.saveChatMessage({ guest_id, role, message, session_id, meta });
  res.json(saved);
}

// GET /api/chat/history - Get chat history for logged-in user
async function getHistory(req, res) {
  const guest_id = req.user ? req.user.id : null;
  const { session_id, limit } = req.query;
  if (!guest_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const messages = await chatService.getChatMessages(guest_id, session_id, limit ? parseInt(limit) : 100);
  res.json(messages);
}

module.exports = { saveMessage, getHistory };