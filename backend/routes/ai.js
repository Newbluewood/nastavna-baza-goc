const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { adminAuthMiddleware, requirePermission } = require('../middleware/auth');
const { aiUsageGuard } = require('../middleware/aiUsageGuard');
const { pingAI, proofread, rewrite } = require('../controllers/aiController');

const router = express.Router();

router.get('/ping', asyncHandler(pingAI));
router.post('/proofread', adminAuthMiddleware, requirePermission('content_ai'), aiUsageGuard, asyncHandler(proofread));
router.post('/rewrite', adminAuthMiddleware, requirePermission('content_ai'), aiUsageGuard, asyncHandler(rewrite));

module.exports = router;
