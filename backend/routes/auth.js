const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { validateRequest, schemas } = require('../middleware/validation');
const { adminAuthMiddleware, requirePermission } = require('../middleware/auth');
const { adminLogin, translate } = require('../controllers/authController');

const router = express.Router();

router.post('/login',    validateRequest(schemas.login), asyncHandler(adminLogin));
router.post('/translate', adminAuthMiddleware, requirePermission('content_ai'), asyncHandler(translate));

module.exports = router;