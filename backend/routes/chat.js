'use strict';

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { optionalGuestAuthMiddleware } = require('../middleware/auth');
const { chatRateLimit } = require('../middleware/chatRateLimit');
const { reserveStayChat, fallbackChat } = require('../controllers/chatController');

const router = express.Router();

/**
 * POST /api/chat/reserve-stay
 * Writes a reservation inquiry into the database.
 * Called from the chat widget after the user confirms a room selection.
 * Optional guest auth: authenticated guests skip name/email fields.
 */
router.post('/reserve-stay', optionalGuestAuthMiddleware, asyncHandler(reserveStayChat));

/**
 * POST /api/chat/fallback
 * Gemini Flash backup endpoint, used by the frontend when the primary
 * microservice (Render) is unreachable or returns an error.
 * Rate-limited to prevent abuse of the free API tier.
 */
router.post('/fallback', chatRateLimit, asyncHandler(fallbackChat));

module.exports = router;
