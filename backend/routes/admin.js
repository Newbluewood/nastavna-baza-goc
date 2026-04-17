const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { adminAuthMiddleware } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');
const { getInquiries, getInquiryActivity, updateInquiryStatus, createNews, getGuests, addVoucher } = require('../controllers/adminController');

const router = express.Router();

router.get('/inquiries',           adminAuthMiddleware,                                      asyncHandler(getInquiries));
router.get('/inquiries/:id/activity', adminAuthMiddleware,                                   asyncHandler(getInquiryActivity));
router.post('/inquiries/:id/status', adminAuthMiddleware, validateRequest(schemas.inquiryStatus), asyncHandler(updateInquiryStatus));
router.post('/news',               adminAuthMiddleware, validateRequest(schemas.news),        asyncHandler(createNews));
router.get('/guests',              adminAuthMiddleware,                                      asyncHandler(getGuests));
router.post('/guests/:id/vouchers', adminAuthMiddleware,                                     asyncHandler(addVoucher));

module.exports = router;
