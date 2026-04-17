const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { guestAuthMiddleware } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');
const { guestLogin, getMe, redeemVoucher, changePassword, getReservations, updateReservationDates } = require('../controllers/guestController');

const router = express.Router();

router.post('/login',                     validateRequest(schemas.guestLogin), asyncHandler(guestLogin));
router.get('/me',                         guestAuthMiddleware,                 asyncHandler(getMe));
router.post('/vouchers/:voucherId/redeem', guestAuthMiddleware,                asyncHandler(redeemVoucher));
router.put('/password',                   guestAuthMiddleware,                 asyncHandler(changePassword));
router.get('/reservations',               guestAuthMiddleware,                 asyncHandler(getReservations));
router.patch('/reservations/:inquiryId',  guestAuthMiddleware,                 asyncHandler(updateReservationDates));

module.exports = router;
