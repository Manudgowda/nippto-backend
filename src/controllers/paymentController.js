const pool = require('../config/db');
const {
  createOrder,
  verifyPaymentSignature,
  calculateDriverEarning
} = require('../utils/razorpay');

// 1. Initialize payment (for UPI/Card)
const initializePayment = async (req, res) => {
  try {
    const { ride_id } = req.body;
    const userId = req.user.id;

    if (!ride_id) {
      return res.status(400).json({
        success: false,
        message: 'ride_id is required'
      });
    }

    // Get ride details
    const ride = await pool.query(
      `SELECT * FROM rides 
       WHERE id = $1 AND user_id = $2 
       AND status = 'completed'`,
      [ride_id, userId]
    );

    if (ride.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Completed ride not found'
      });
    }

    const rideData = ride.rows[0];

    // Check if already paid
    const existingPayment = await pool.query(
      `SELECT * FROM payments 
       WHERE ride_id = $1 
       AND payment_status = 'completed'`,
      [ride_id]
    );

    if (existingPayment.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ride already paid'
      });
    }

    // Create Razorpay order
    const order = await createOrder(
      rideData.fare,
      'INR',
      `nippto_${ride_id}`
    );

    // Save payment record
    await pool.query(
      `INSERT INTO payments (
        ride_id, user_id, driver_id,
        amount, payment_method,
        razorpay_order_id, payment_status
      ) VALUES ($1,$2,$3,$4,'upi',$5,'pending')`,
      [
        ride_id,
        userId,
        rideData.driver_id,
        rideData.fare,
        order.id
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Payment initialized',
      payment: {
        order_id: order.id,
        amount: rideData.fare,
        currency: 'INR',
        razorpay_key: process.env.RAZORPAY_KEY_ID,
        ride_id,
        prefill: {
          name: req.user.name || 'Nippto User',
          contact: req.user.phone
        }
      }
    });

  } catch (error) {
    console.error('initializePayment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 2. Verify and confirm payment
const verifyPayment = async (req, res) => {
  try {
    const {
      ride_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (!ride_id || !razorpay_order_id ||
        !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'All payment fields are required'
      });
    }

    // Verify signature
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Get ride details
    const ride = await pool.query(
      `SELECT * FROM rides WHERE id = $1`,
      [ride_id]
    );

    const rideData = ride.rows[0];

    // Update payment record
    await pool.query(
      `UPDATE payments 
       SET payment_status = 'completed',
           razorpay_payment_id = $1,
           razorpay_signature = $2,
           payment_method = 'upi',
           updated_at = CURRENT_TIMESTAMP
       WHERE razorpay_order_id = $3`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id]
    );

    // Update ride payment status
    await pool.query(
      `UPDATE rides 
       SET payment_status = 'completed',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [ride_id]
    );

    // Calculate and save driver earnings
    const earnings = calculateDriverEarning(rideData.fare);

    await pool.query(
      `INSERT INTO driver_earnings (
        driver_id, ride_id, gross_amount,
        commission_rate, commission_amount,
        net_amount, payment_method, status
      ) VALUES ($1,$2,$3,$4,$5,$6,'upi','settled')`,
      [
        rideData.driver_id,
        ride_id,
        earnings.gross_amount,
        earnings.commission_rate,
        earnings.commission_amount,
        earnings.net_amount
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Payment successful! 🎉',
      payment: {
        payment_id: razorpay_payment_id,
        amount: rideData.fare,
        driver_earning: earnings.net_amount,
        nippto_commission: earnings.commission_amount
      }
    });

  } catch (error) {
    console.error('verifyPayment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 3. Cash payment confirmation
const confirmCashPayment = async (req, res) => {
  try {
    const { ride_id } = req.body;
    const driverId = req.user.id;

    if (!ride_id) {
      return res.status(400).json({
        success: false,
        message: 'ride_id is required'
      });
    }

    // Verify this driver owns this completed ride
    const ride = await pool.query(
      `SELECT * FROM rides 
       WHERE id = $1 
       AND driver_id = $2 
       AND status = 'completed'
       AND payment_method = 'cash'`,
      [ride_id, driverId]
    );

    if (ride.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found or not a cash ride'
      });
    }

    const rideData = ride.rows[0];

    // Check already recorded
    const existing = await pool.query(
      `SELECT id FROM payments WHERE ride_id = $1`,
      [ride_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment already recorded'
      });
    }

    // Record cash payment
    await pool.query(
      `INSERT INTO payments (
        ride_id, user_id, driver_id,
        amount, payment_method, payment_status
      ) VALUES ($1,$2,$3,$4,'cash','completed')`,
      [ride_id, rideData.user_id, driverId, rideData.fare]
    );

    // Update ride
    await pool.query(
      `UPDATE rides 
       SET payment_status = 'completed',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [ride_id]
    );

    // Calculate driver earnings (cash)
    const earnings = calculateDriverEarning(rideData.fare);

    await pool.query(
      `INSERT INTO driver_earnings (
        driver_id, ride_id, gross_amount,
        commission_rate, commission_amount,
        net_amount, payment_method, status
      ) VALUES ($1,$2,$3,$4,$5,$6,'cash','pending')`,
      [
        driverId,
        ride_id,
        earnings.gross_amount,
        earnings.commission_rate,
        earnings.commission_amount,
        earnings.net_amount
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Cash payment recorded ✅',
      earnings: {
        fare: rideData.fare,
        your_earning: earnings.net_amount,
        nippto_commission: earnings.commission_amount
      }
    });

  } catch (error) {
    console.error('confirmCashPayment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 4. Get driver earnings
const getDriverEarnings = async (req, res) => {
  try {
    const driverId = req.user.id;

    // Today's earnings
    const todayEarnings = await pool.query(
      `SELECT 
        COUNT(*) as total_rides,
        COALESCE(SUM(net_amount), 0) as total_earned,
        COALESCE(SUM(commission_amount), 0) as total_commission
       FROM driver_earnings
       WHERE driver_id = $1
       AND DATE(created_at) = CURRENT_DATE`,
      [driverId]
    );

    // Weekly earnings
    const weeklyEarnings = await pool.query(
      `SELECT 
        COUNT(*) as total_rides,
        COALESCE(SUM(net_amount), 0) as total_earned
       FROM driver_earnings
       WHERE driver_id = $1
       AND created_at >= NOW() - INTERVAL '7 days'`,
      [driverId]
    );

    // Recent earnings list
    const recentEarnings = await pool.query(
      `SELECT de.*, r.pickup_address, r.drop_address,
              r.created_at as ride_time
       FROM driver_earnings de
       JOIN rides r ON de.ride_id = r.id
       WHERE de.driver_id = $1
       ORDER BY de.created_at DESC
       LIMIT 10`,
      [driverId]
    );

    res.status(200).json({
      success: true,
      earnings: {
        today: todayEarnings.rows[0],
        this_week: weeklyEarnings.rows[0],
        recent: recentEarnings.rows
      }
    });

  } catch (error) {
    console.error('getDriverEarnings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 5. Get payment history (rider)
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const payments = await pool.query(
      `SELECT p.*, r.pickup_address, r.drop_address,
              r.vehicle_type, r.created_at as ride_time
       FROM payments p
       JOIN rides r ON p.ride_id = r.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT 20`,
      [userId]
    );

    res.status(200).json({
      success: true,
      count: payments.rows.length,
      payments: payments.rows
    });

  } catch (error) {
    console.error('getPaymentHistory error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 6. Get wallet balance
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.type;

    let wallet = await pool.query(
      `SELECT * FROM wallets WHERE user_id = $1`,
      [userId]
    );

    // Create wallet if not exists
    if (wallet.rows.length === 0) {
      wallet = await pool.query(
        `INSERT INTO wallets (user_id, user_type, balance)
         VALUES ($1, $2, 0.00)
         RETURNING *`,
        [userId, userType]
      );
    }

    res.status(200).json({
      success: true,
      wallet: {
        balance: wallet.rows[0].balance,
        total_earned: wallet.rows[0].total_earned,
        total_spent: wallet.rows[0].total_spent
      }
    });

  } catch (error) {
    console.error('getWalletBalance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  initializePayment,
  verifyPayment,
  confirmCashPayment,
  getDriverEarnings,
  getPaymentHistory,
  getWalletBalance
};