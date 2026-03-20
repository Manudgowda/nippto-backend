const express = require('express');
const router = express.Router();
const {
  getFareEstimate,
  createRideRequest,
  acceptRide,
  startRide,
  completeRide,
  cancelRide,
  getRideDetails,
  getRideHistory
} = require('../controllers/bookingController');
const { authenticateToken, isRider, isDriver } = require('../middleware/auth');

// Rider routes
router.post('/estimate', authenticateToken, getFareEstimate);
router.post('/request', authenticateToken, isRider, createRideRequest);
router.get('/history', authenticateToken, getRideHistory);
router.get('/:ride_id', authenticateToken, getRideDetails);
router.post('/cancel', authenticateToken, cancelRide);

// Driver routes
router.post('/accept', authenticateToken, isDriver, acceptRide);
router.post('/start', authenticateToken, isDriver, startRide);
router.post('/complete', authenticateToken, isDriver, completeRide);

module.exports = router;