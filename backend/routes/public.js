const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { validateRequest, validateInquiryRequest, schemas } = require('../middleware/validation');
const { optionalGuestAuthMiddleware } = require('../middleware/auth');
const {
  getHome, getFacilities, getFacility, getRoomAvailability,
  submitInquiry, getNewsList, getSingleNews, likeNews,
  getWeatherForecast, getContactPage, getThemes, getThemeDetail,
  getRestaurantsPublic, getRestaurantMenu, getPageBySlug
} = require('../controllers/publicController');
const cacheMiddleware = require('../middleware/cacheMiddleware');

const router = express.Router();

console.log('Public routes loaded');

// Test route
router.get('/test', (req, res) => {
  console.log('Test route called at', new Date());
  res.json({ message: 'Test successful', timestamp: new Date() });
});

// 5 minuta kesa za sve javne read-only endpointe
const CACHE_TTL = 5 * 60 * 1000;

router.get('/home',                           cacheMiddleware(CACHE_TTL), asyncHandler(getHome));
router.get('/smestaj',                        cacheMiddleware(CACHE_TTL), asyncHandler(getFacilities));
router.get('/smestaj/:id',                    cacheMiddleware(CACHE_TTL), asyncHandler(getFacility));
router.get('/rooms/:id/availability',         asyncHandler(getRoomAvailability)); // Do not cache availability heavily
router.post('/inquiries', optionalGuestAuthMiddleware, validateInquiryRequest(), asyncHandler(submitInquiry));
router.get('/news',                           cacheMiddleware(CACHE_TTL), asyncHandler(getNewsList));
router.get('/news/:id',                       cacheMiddleware(CACHE_TTL), asyncHandler(getSingleNews));
router.post('/news/:id/like',                 asyncHandler(likeNews));
router.get('/weather/forecast',               cacheMiddleware(15 * 60 * 1000), asyncHandler(getWeatherForecast)); // 15 min cache for weather
router.get('/kontakt',                        cacheMiddleware(CACHE_TTL), asyncHandler(getContactPage));
router.get('/themes',                         cacheMiddleware(CACHE_TTL), asyncHandler(getThemes));
router.get('/themes/:id',                     cacheMiddleware(CACHE_TTL), asyncHandler(getThemeDetail));
router.get('/restorani',                      cacheMiddleware(CACHE_TTL), asyncHandler(getRestaurantsPublic));
router.get('/restorani/:id/meni',             cacheMiddleware(CACHE_TTL), asyncHandler(getRestaurantMenu));
router.get('/stranica/:slug',                 cacheMiddleware(CACHE_TTL), asyncHandler(getPageBySlug));

module.exports = router;