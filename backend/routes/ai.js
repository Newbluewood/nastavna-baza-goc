'use strict';

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { adminAuthMiddleware } = require('../middleware/auth');
const { pingAI, proofread, rewrite } = require('../controllers/aiController');

const router = express.Router();

/**
 * AI Utilities for Admin Dashboard
 * Proofreading and rewriting content.
 * (Note: Rate limiting was removed with the old chat service cleanup).
 */

router.get('/ping', asyncHandler(pingAI));
router.post('/proofread', adminAuthMiddleware, asyncHandler(proofread));
router.post('/rewrite', adminAuthMiddleware, asyncHandler(rewrite));

module.exports = router;
