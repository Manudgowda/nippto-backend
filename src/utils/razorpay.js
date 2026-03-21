const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create Razorpay order
const createOrder = async (amount, currency = 'INR', receipt) => {
  const options = {
    amount: Math.round(amount * 100), // Convert to paise
    currency,
    receipt: receipt || `nippto_${Date.now()}`,
    payment_capture: 1
  };
  return await razorpay.orders.create(options);
};

// Verify Razorpay payment signature
const verifyPaymentSignature = (orderId, paymentId, signature) => {
  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');
  return expectedSignature === signature;
};

// Calculate driver commission
const calculateDriverEarning = (fare, commissionRate = 15) => {
  const commission = (fare * commissionRate) / 100;
  const netEarning = fare - commission;
  return {
    gross_amount: fare,
    commission_rate: commissionRate,
    commission_amount: Math.round(commission * 100) / 100,
    net_amount: Math.round(netEarning * 100) / 100
  };
};

module.exports = { createOrder, verifyPaymentSignature, calculateDriverEarning };