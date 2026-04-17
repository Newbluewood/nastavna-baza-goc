const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { validateRequest, schemas } = require('../middleware/validation');
const {
  getHome, getFacilities, getFacility, getRoomAvailability,
  submitInquiry, getNewsList, getSingleNews, likeNews
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
router.post('/inquiries', validateRequest(schemas.inquiry), asyncHandler(submitInquiry));
router.get('/news',                           asyncHandler(getNewsList));
router.get('/news/:id',                       asyncHandler(getSingleNews));
router.post('/news/:id/like',                 asyncHandler(likeNews));

module.exports = router;