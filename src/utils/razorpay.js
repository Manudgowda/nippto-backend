let razorpay = null;

try {
  const Razorpay = require('razorpay');
  if (process.env.RAZORPAY_KEY_ID && 
      process.env.RAZORPAY_KEY_ID !== 'rzp_test_your_key_id_here') {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
} catch (err) {
  console.log('Razorpay not configured');
}

module.exports = razorpay;