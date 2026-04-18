const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { optionalGuestAuthMiddleware } = require('../middleware/auth');
const { planStayChat, suggestVisitChat, reserveStayChat } = require('../controllers/chatController');

const router = express.Router();

router.post('/plan-stay', asyncHandler(planStayChat));
router.post('/suggest-visit', asyncHandler(suggestVisitChat));
router.post('/reserve-stay', optionalGuestAuthMiddleware, asyncHandler(reserveStayChat));

module.exports = router;