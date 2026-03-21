const express = require('express');
const router = express.Router();
const {
  initializePayment,
  verifyPayment,
  confirmCashPayment,
  getDriverEarnings,
  getPaymentHistory,
  getWalletBalance
} = require('../controllers/paymentController');
const {
  authenticateToken,
  isRider,
  isDriver
} = require('../middleware/auth');

// Rider payment routes
router.post('/initialize', authenticateToken, isRider, initializePayment);
router.post('/verify', authenticateToken, isRider, verifyPayment);
router.get('/history', authenticateToken, isRider, getPaymentHistory);
router.get('/wallet', authenticateToken, getWalletBalance);

// Driver payment routes
router.post('/cash-confirm', authenticateToken, isDriver, confirmCashPayment);
router.get('/earnings', authenticateToken, isDriver, getDriverEarnings);

module.exports = router;