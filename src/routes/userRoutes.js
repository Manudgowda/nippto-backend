const express = require('express');
const router = express.Router();
const { getUserProfile, updateUserProfile } = require('../controllers/userController');
const { authenticateToken, isRider } = require('../middleware/auth');

// All routes protected
router.get('/profile', authenticateToken, isRider, getUserProfile);
router.put('/profile', authenticateToken, isRider, updateUserProfile);

module.exports = router;