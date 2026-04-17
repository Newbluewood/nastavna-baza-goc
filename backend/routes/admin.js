const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { adminAuthMiddleware } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');
const {
	getInquiries,
	getInquiryActivity,
	updateInquiryStatus,
	createNews,
	getAdminNews,
	getAdminNewsById,
	updateNews,
	deleteNews,
	getGuests,
	addVoucher
} = require('../controllers/adminController');

const router = express.Router();

router.get('/inquiries',           adminAuthMiddleware,                                      asyncHandler(getInquiries));
router.get('/inquiries/:id/activity', adminAuthMiddleware,                                   asyncHandler(getInquiryActivity));
router.post('/inquiries/:id/status', adminAuthMiddleware, validateRequest(schemas.inquiryStatus), asyncHandler(updateInquiryStatus));
router.get('/news',                adminAuthMiddleware,                                      asyncHandler(getAdminNews));
router.get('/news/:id',            adminAuthMiddleware,                                      asyncHandler(getAdminNewsById));
router.post('/news',               adminAuthMiddleware, validateRequest(schemas.news),        asyncHandler(createNews));
router.put('/news/:id',            adminAuthMiddleware, validateRequest(schemas.news),        asyncHandler(updateNews));
router.delete('/news/:id',         adminAuthMiddleware,                                      asyncHandler(deleteNews));
router.get('/guests',              adminAuthMiddleware,                                      asyncHandler(getGuests));
router.post('/guests/:id/vouchers', adminAuthMiddleware,                                     asyncHandler(addVoucher));

module.exports = router;
