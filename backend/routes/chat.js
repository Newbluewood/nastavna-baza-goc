const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { optionalGuestAuthMiddleware } = require('../middleware/auth');
const { inquiryRateLimit } = require('../middleware/rateLimit');
const { reserveStayChat } = require('../controllers/chatController');
const { saveMessage, getHistory } = require('../controllers/chatHistoryController');

const router = express.Router();

// Widget text goes to chat-agent (SSE). These routes are the site's hands:
// inquiry insert, and history for a logged-in guest.
// Legacy AI routes (plan-stay, suggest-visit, site-guide-turn, fallback)
// are unmounted. Code lives in backend/archive/legacy-chat/.
router.post('/reserve-stay', inquiryRateLimit, optionalGuestAuthMiddleware, asyncHandler(reserveStayChat));
router.post('/history', optionalGuestAuthMiddleware, asyncHandler(saveMessage));
router.get('/history', optionalGuestAuthMiddleware, asyncHandler(getHistory));

module.exports = router;
