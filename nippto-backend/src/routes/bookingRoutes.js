const express = require('express');
const router = express.Router();
const { authMiddleware, roleGuard } = require('../middleware/auth');
const {
  getFareEstimate,
  requestRide,
  getRideHistory,
  getActiveRide,
  cancelRide,
} = require('../controllers/bookingController');

// All booking routes require authentication as a rider
router.use(authMiddleware);
router.use(roleGuard('user'));

// POST /booking/estimate — get fare estimate
router.post('/estimate', getFareEstimate);

// POST /booking/request — request a ride
router.post('/request', requestRide);

// GET /booking/history — ride history
router.get('/history', getRideHistory);

// GET /booking/active — current active ride
router.get('/active', getActiveRide);

// POST /booking/cancel/:rideId — cancel a pending ride
router.post('/cancel/:rideId', cancelRide);

module.exports = router;
