const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { optionalGuestAuthMiddleware } = require('../middleware/auth');
const { planStayChat, suggestVisitChat, reserveStayChat, siteGuideTurn } = require('../controllers/chatController');
const { saveMessage, getHistory } = require('../controllers/chatHistoryController');
const budgetGate = require('../middleware/budgetGate');
const { chatRateLimit } = require('../middleware/chatRateLimit');
const { aiUsageGuard } = require('../middleware/aiUsageGuard');

const router = express.Router();

router.post('/plan-stay', optionalGuestAuthMiddleware, asyncHandler(planStayChat));
router.post('/suggest-visit', asyncHandler(suggestVisitChat));
router.post('/reserve-stay', optionalGuestAuthMiddleware, asyncHandler(reserveStayChat));

router.post(
  '/site-guide-turn',
  optionalGuestAuthMiddleware,
  chatRateLimit,
  aiUsageGuard,
  budgetGate('site_guide'),
  asyncHandler(siteGuideTurn)
);

// Chat history endpoints
router.post('/history', optionalGuestAuthMiddleware, asyncHandler(saveMessage));
router.get('/history', optionalGuestAuthMiddleware, asyncHandler(getHistory));

module.exports = router;
