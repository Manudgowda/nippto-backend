const express = require('express');
const router = express.Router();
const { sendLoginOTP, verifyLoginOTP } = require('../controllers/authController');

// POST /api/auth/send-otp
router.post('/send-otp', sendLoginOTP);

// POST /api/auth/verify-otp
router.post('/verify-otp', verifyLoginOTP);

module.exports = router;