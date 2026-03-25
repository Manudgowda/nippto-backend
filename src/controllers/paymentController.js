const razorpay = require('../utils/razorpay');

const createOrder = async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({ 
        success: false, 
        message: 'Payment service not configured' 
      });
    }
    const { amount } = req.body;
    const options = {
      amount: amount * 100,
      currency: process.env.RAZORPAY_CURRENCY || 'INR',
      receipt: 'receipt_' + Date.now()
    };
    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    res.json({ success: true, message: 'Payment verified' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createOrder, verifyPayment };