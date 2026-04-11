const express = require('express');
const router = express.Router();
const { authMiddleware, roleGuard } = require('../middleware/auth');
const { getProfile, getRideHistory, updateProfile, getEarnings } = require('../controllers/driverController');

// All driver routes require driver JWT
router.use(authMiddleware);
router.use(roleGuard('driver'));

// GET /api/driver/profile
router.get('/profile', getProfile);

// PUT /api/driver/profile
router.put('/profile', updateProfile);

// GET /api/driver/rides
router.get('/rides', getRideHistory);

// GET /api/driver/earnings
router.get('/earnings', getEarnings);

module.exports = router;
