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
	addVoucher,
	getRoomMap,
	getChatMetrics,
	getProjects,
	createProject,
	updateProject,
	deleteProject,
	getStaff,
	createStaffMember,
	updateStaffMember,
	deleteStaffMember
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
router.get('/room-map',            adminAuthMiddleware,                                      asyncHandler(getRoomMap));
router.get('/chat-metrics',        adminAuthMiddleware,                                      asyncHandler(getChatMetrics));

// Projects CRUD
router.get('/projects',            adminAuthMiddleware,                                      asyncHandler(getProjects));
router.post('/projects',           adminAuthMiddleware,                                      asyncHandler(createProject));
router.put('/projects/:id',        adminAuthMiddleware,                                      asyncHandler(updateProject));
router.delete('/projects/:id',     adminAuthMiddleware,                                      asyncHandler(deleteProject));

// Staff CRUD
router.get('/staff',               adminAuthMiddleware,                                      asyncHandler(getStaff));
router.post('/staff',              adminAuthMiddleware,                                      asyncHandler(createStaffMember));
router.put('/staff/:id',           adminAuthMiddleware,                                      asyncHandler(updateStaffMember));
router.delete('/staff/:id',        adminAuthMiddleware,                                      asyncHandler(deleteStaffMember));

module.exports = router;
