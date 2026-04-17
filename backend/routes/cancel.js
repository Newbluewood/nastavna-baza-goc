const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { getCancelInfo, cancelReservation } = require('../controllers/cancelController');

const router = express.Router();

router.get('/:token',  asyncHandler(getCancelInfo));
router.post('/:token', asyncHandler(cancelReservation));

module.exports = router;
