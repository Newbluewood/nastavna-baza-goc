const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { adminAuthMiddleware, requirePermission } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');
const invalidatePublicCacheOnWrite = require('../middleware/invalidatePublicCache');
const {
	getInquiries,
	getInquiryActivity,
	updateInquiryStatus,
	createAdminReservation,
	createNews,
	getAdminNews,
	getAdminNewsById,
	updateNews,
	deleteNews,
	getGuests,
	addVoucher,
	getRoomMap,
	getChatMetrics,
	getChatAnalyticsTop,
	getChatAnalyticsMiss,
	getSiteStats,
	getAiUsage,
	seedSiteKbNow,
	getProjects,
	createProject,
	updateProject,
	deleteProject,
	getStaff,
	createStaffMember,
	updateStaffMember,
	deleteStaffMember,
	getPages,
	getPageById,
	createPage,
	updatePage,
	deletePage,
	getThemes,
	getThemeById,
	createTheme,
	updateTheme,
	deleteTheme,
	getSettings,
	updateSettings,
	getHeroSlides,
	createHeroSlide,
	updateHeroSlide,
	deleteHeroSlide,
	purgeCache,
	refreshAgentKnowledge,
	uploadImage,
	getFacilities,
	updateFacility,
	getRoomsByFacility,
	updateRoom,
	getRestaurants,
	updateRestaurant,
	getMenuItems,
	createMenuItem,
	updateMenuItem,
	deleteMenuItem,
	getAdminNav,
	updateNavItem,
	createNavItem,
	deleteNavItem,
	reorderNav,
	listCmsUsers,
	createCmsUser,
	updateCmsUser,
	deleteCmsUser,
} = require('../controllers/admin');

const router = express.Router();

/** Auth + module permission chain */
function guard(module) {
	return [adminAuthMiddleware, requirePermission(module)];
}

// Successful admin writes clear the public GET cache (TTL fallback remains).
router.use(invalidatePublicCacheOnWrite);

router.get('/inquiries',           ...guard('inquiries'),                                      asyncHandler(getInquiries));
router.get('/inquiries/:id/activity', ...guard('inquiries'),                                   asyncHandler(getInquiryActivity));
router.post('/inquiries/:id/status', ...guard('inquiries'), validateRequest(schemas.inquiryStatus), asyncHandler(updateInquiryStatus));
router.post('/reservations',       ...guard('inquiries'), validateRequest(schemas.adminReservation), asyncHandler(createAdminReservation));
router.get('/news',                ...guard('news'),                                      asyncHandler(getAdminNews));
router.get('/news/:id',            ...guard('news'),                                      asyncHandler(getAdminNewsById));
router.post('/news',               ...guard('news'), validateRequest(schemas.news),        asyncHandler(createNews));
router.put('/news/:id',            ...guard('news'), validateRequest(schemas.news),        asyncHandler(updateNews));
router.delete('/news/:id',         ...guard('news'),                                      asyncHandler(deleteNews));
router.get('/guests',              ...guard('guests'),                                      asyncHandler(getGuests));
router.post('/guests/:id/vouchers', ...guard('guests'),                                     asyncHandler(addVoucher));
router.get('/room-map',            ...guard('room_map'),                                      asyncHandler(getRoomMap));
router.get('/chat-metrics',        ...guard('stats'),                                      asyncHandler(getChatMetrics));
router.get('/chat-analytics/top',  ...guard('stats'),                                      asyncHandler(getChatAnalyticsTop));
router.get('/chat-analytics/miss', ...guard('stats'),                                      asyncHandler(getChatAnalyticsMiss));
router.get('/site-stats',          ...guard('stats'),                                      asyncHandler(getSiteStats));
router.get('/ai/usage',            ...guard('ai_usage'),                                      asyncHandler(getAiUsage));
router.post('/ai/seed-site-kb',    ...guard('ai_usage'),                                      asyncHandler(seedSiteKbNow));
router.post('/ai/refresh-knowledge', ...guard('system'),                                    asyncHandler(refreshAgentKnowledge));
// Projects CRUD
router.get('/projects',            ...guard('projects'),                                      asyncHandler(getProjects));
router.post('/projects',           ...guard('projects'),                                      asyncHandler(createProject));
router.put('/projects/:id',        ...guard('projects'),                                      asyncHandler(updateProject));
router.delete('/projects/:id',     ...guard('projects'),                                      asyncHandler(deleteProject));

// Staff CRUD
router.get('/staff',               ...guard('staff'),                                      asyncHandler(getStaff));
router.post('/staff',              ...guard('staff'),                                      asyncHandler(createStaffMember));
router.put('/staff/:id',           ...guard('staff'),                                      asyncHandler(updateStaffMember));
router.delete('/staff/:id',        ...guard('staff'),                                      asyncHandler(deleteStaffMember));

// Pages CRUD
router.get('/pages',               ...guard('pages'),                                      asyncHandler(getPages));
router.get('/pages/:id',           ...guard('pages'),                                      asyncHandler(getPageById));
router.post('/pages',              ...guard('pages'),                                      asyncHandler(createPage));
router.put('/pages/:id',           ...guard('pages'),                                      asyncHandler(updatePage));
router.delete('/pages/:id',        ...guard('pages'),                                      asyncHandler(deletePage));

// Public header menu (nav_items)
router.get('/nav',                 ...guard('pages'),                                      asyncHandler(getAdminNav));
router.post('/nav',                ...guard('pages'),                                      asyncHandler(createNavItem));
router.put('/nav/reorder',         ...guard('pages'),                                      asyncHandler(reorderNav));
router.put('/nav/:id',             ...guard('pages'),                                      asyncHandler(updateNavItem));
router.delete('/nav/:id',          ...guard('pages'),                                      asyncHandler(deleteNavItem));

// Themes CRUD (Istraži Goč)
router.get('/themes',              ...guard('themes'),                                      asyncHandler(getThemes));
router.get('/themes/:id',          ...guard('themes'),                                      asyncHandler(getThemeById));
router.post('/themes',             ...guard('themes'),                                      asyncHandler(createTheme));
router.put('/themes/:id',          ...guard('themes'),                                      asyncHandler(updateTheme));
router.delete('/themes/:id',       ...guard('themes'),                                      asyncHandler(deleteTheme));

// Site Settings
router.get('/settings',            ...guard('settings'),                                      asyncHandler(getSettings));
router.put('/settings',            ...guard('settings'),                                      asyncHandler(updateSettings));

// Hero Slides
router.get('/hero-slides',         ...guard('hero'),                                      asyncHandler(getHeroSlides));
router.post('/hero-slides',        ...guard('hero'),                                      asyncHandler(createHeroSlide));
router.put('/hero-slides/:id',     ...guard('hero'),                                      asyncHandler(updateHeroSlide));
router.delete('/hero-slides/:id',  ...guard('hero'),                                      asyncHandler(deleteHeroSlide));

// Uploads
router.post('/upload',             ...guard('upload'),                                      asyncHandler(uploadImage));

// Cache Management
router.post('/system/purge-cache', ...guard('system'),                                      asyncHandler(purgeCache));

// Facility & Room management
router.get('/facilities',          ...guard('rooms'),                                      asyncHandler(getFacilities));
router.put('/facilities/:id',      ...guard('rooms'),                                      asyncHandler(updateFacility));
router.get('/facilities/:id/rooms', ...guard('rooms'),                                     asyncHandler(getRoomsByFacility));
router.put('/rooms/:id',           ...guard('rooms'),                                      asyncHandler(updateRoom));

// Restaurant & Menu management
router.get('/restaurants',        ...guard('restaurant'),                                      asyncHandler(getRestaurants));
router.put('/restaurants/:id',     ...guard('restaurant'),                                      asyncHandler(updateRestaurant));
router.get('/restaurants/:id/menu', ...guard('restaurant'),                                    asyncHandler(getMenuItems));
router.post('/menu-items',        ...guard('restaurant'),                                      asyncHandler(createMenuItem));
router.put('/menu-items/:id',     ...guard('restaurant'),                                      asyncHandler(updateMenuItem));
router.delete('/menu-items/:id',  ...guard('restaurant'),                                      asyncHandler(deleteMenuItem));

// CMS users (Admin only)
router.get('/cms-users',          ...guard('cms_users'),                                     asyncHandler(listCmsUsers));
router.post('/cms-users',         ...guard('cms_users'), validateRequest(schemas.cmsUserCreate), asyncHandler(createCmsUser));
router.patch('/cms-users/:id',    ...guard('cms_users'), validateRequest(schemas.cmsUserUpdate), asyncHandler(updateCmsUser));
router.delete('/cms-users/:id',   ...guard('cms_users'),                                     asyncHandler(deleteCmsUser));


module.exports = router;
