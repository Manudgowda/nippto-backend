const express = require('express');
const router = express.Router();

let paymentController;
try {
  paymentController = require('../controllers/paymentController');
} catch (err) {
  paymentController = {
    createOrder: (req, res) => res.json({ success: false, message: 'Payment not configured' }),
    verifyPayment: (req, res) => res.json({ success: false, message: 'Payment not configured' })
  };
}

const { createOrder, verifyPayment } = paymentController;

router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);

module.exports = router;