const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { validateRequest, validateInquiryRequest, schemas } = require('../middleware/validation');
const { optionalGuestAuthMiddleware } = require('../middleware/auth');
const {
  getHome, getFacilities, getFacility, getRoomAvailability,
  submitInquiry, getNewsList, getSingleNews, likeNews,
  getWeatherForecast, getContactPage, getThemes, getThemeDetail,
  getRestaurantsPublic, getRestaurantMenu, getPageBySlug, getNav, getSiteSettings
} = require('../controllers/publicController');
const cacheMiddleware = require('../middleware/cacheMiddleware');
const { inquiryRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

router.get('/test', (req, res) => {
  res.json({ message: 'Test successful', timestamp: new Date() });
});

// Liveness + DB readiness (used by FE cold-start gate).
// Hard-cap the DB probe so a stuck MySQL never leaves the request open.
router.get('/health', async (req, res) => {
  const started = Date.now();
  const timeoutMs = Number(process.env.HEALTH_DB_TIMEOUT_MS || 4000);
  try {
    await Promise.race([
      req.app.locals.db.query('SELECT 1'),
      new Promise((_, reject) => {
        setTimeout(() => {
          const err = new Error(`DB health probe timed out after ${timeoutMs}ms`);
          err.code = 'HEALTH_DB_TIMEOUT';
          reject(err);
        }, timeoutMs);
      }),
    ]);
    res.json({ ok: true, db: true, ms: Date.now() - started, ts: new Date().toISOString() });
  } catch (error) {
    console.error('[health] DB check failed:', error.code || error.message);
    res.status(503).json({
      ok: false,
      db: false,
      error: error.code === 'HEALTH_DB_TIMEOUT' ? 'Database timeout' : 'Database unavailable',
      ms: Date.now() - started,
      ts: new Date().toISOString(),
    });
  }
});

// 5 minuta kesa za sve javne read-only endpointe
const CACHE_TTL = 5 * 60 * 1000;

router.get('/home',                           cacheMiddleware(CACHE_TTL), asyncHandler(getHome));
router.get('/smestaj',                        cacheMiddleware(CACHE_TTL), asyncHandler(getFacilities));
router.get('/smestaj/:id',                    cacheMiddleware(CACHE_TTL), asyncHandler(getFacility));
router.get('/rooms/:id/availability',         asyncHandler(getRoomAvailability)); // Do not cache availability heavily
router.post('/inquiries', inquiryRateLimit, optionalGuestAuthMiddleware, validateInquiryRequest(), asyncHandler(submitInquiry));
router.get('/news',                           cacheMiddleware(CACHE_TTL), asyncHandler(getNewsList));
router.get('/news/:id',                       cacheMiddleware(CACHE_TTL), asyncHandler(getSingleNews));
router.post('/news/:id/like',                 asyncHandler(likeNews));
router.get('/weather/forecast',               cacheMiddleware(15 * 60 * 1000), asyncHandler(getWeatherForecast)); // 15 min cache for weather
router.get('/kontakt',                        cacheMiddleware(CACHE_TTL), asyncHandler(getContactPage));
router.get('/themes',                         cacheMiddleware(CACHE_TTL), asyncHandler(getThemes));
router.get('/themes/:id',                     cacheMiddleware(CACHE_TTL), asyncHandler(getThemeDetail));
router.get('/restorani',                      cacheMiddleware(CACHE_TTL), asyncHandler(getRestaurantsPublic));
router.get('/restorani/:id/meni',             cacheMiddleware(CACHE_TTL), asyncHandler(getRestaurantMenu));
// No cache: menu labels must reflect CMS/nav edits immediately (and home-label repairs).
router.get('/nav',                            asyncHandler(getNav));
router.get('/stranica/:slug',                 cacheMiddleware(CACHE_TTL), asyncHandler(getPageBySlug));
router.get('/settings',                       cacheMiddleware(CACHE_TTL), asyncHandler(getSiteSettings));

module.exports = router;