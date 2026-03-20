const express = require('express');
const router = express.Router();
const {
  getDriverProfile,
  updateDriverProfile,
  toggleDriverStatus,
  updateDriverLocation
} = require('../controllers/driverController');
const { authenticateToken, isDriver } = require('../middleware/auth');

// All routes protected
router.get('/profile', authenticateToken, isDriver, getDriverProfile);
router.put('/profile', authenticateToken, isDriver, updateDriverProfile);
router.put('/status', authenticateToken, isDriver, toggleDriverStatus);
router.put('/location', authenticateToken, isDriver, updateDriverLocation);

module.exports = router;