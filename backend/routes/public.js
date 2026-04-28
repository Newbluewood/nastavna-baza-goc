const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { validateRequest, validateInquiryRequest, schemas } = require('../middleware/validation');
const { optionalGuestAuthMiddleware } = require('../middleware/auth');
const {
  getHome, getFacilities, getFacility, getRoomAvailability,
  submitInquiry, getNewsList, getSingleNews, likeNews,
  getWeatherForecast, getContactPage
} = require('../controllers/publicController');

const router = express.Router();

console.log('Public routes loaded');

// Test route
router.get('/test', (req, res) => {
  console.log('Test route called at', new Date());
  res.json({ message: 'Test successful', timestamp: new Date() });
});

router.get('/home',                           asyncHandler(getHome));
router.get('/smestaj',                        asyncHandler(getFacilities));
router.get('/smestaj/:id',                    asyncHandler(getFacility));
router.get('/rooms/:id/availability',         asyncHandler(getRoomAvailability));
router.post('/inquiries', optionalGuestAuthMiddleware, validateInquiryRequest(), asyncHandler(submitInquiry));
router.get('/news',                           asyncHandler(getNewsList));
router.get('/news/:id',                       asyncHandler(getSingleNews));
router.post('/news/:id/like',                 asyncHandler(likeNews));
router.get('/weather/forecast',               asyncHandler(getWeatherForecast));
router.get('/kontakt',                        asyncHandler(getContactPage));

module.exports = router;