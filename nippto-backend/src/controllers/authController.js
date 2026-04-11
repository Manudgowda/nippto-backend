const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { generateOTP, saveOTP, verifyOTP: verifyOTPFromDB } = require('../utils/otp');

/**
 * POST /api/auth/send-otp
 * Body: { phone, user_type? } — user_type defaults to 'user'
 * Generates OTP and (for now) returns it in debug_otp field
 */
const sendOTP = async (req, res, next) => {
  try {
    const { phone, user_type = 'user' } = req.body;

    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit phone number.',
      });
    }

    if (!['user', 'driver'].includes(user_type)) {
      return res.status(400).json({
        success: false,
        message: 'user_type must be "user" or "driver".',
      });
    }

    const otp = generateOTP();
    await saveOTP(pool, phone, otp, user_type);

    console.log(`📱 OTP for ${phone} (${user_type}): ${otp}`);

    // In production: send real SMS here via Twilio/MSG91/AWS SNS
    // For now we return debug_otp so the Flutter app can show it on screen
    return res.json({
      success: true,
      message: `OTP sent to ${phone}`,
      debug_otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
      // Remove debug_otp in real production and plug in real SMS gateway
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/verify-otp
 * Body: { phone, otp, user_type }
 * Verifies OTP and returns JWT + user/driver record
 */
const verifyOTP = async (req, res, next) => {
  try {
    const { phone, otp, user_type = 'user' } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone and OTP are required.',
      });
    }

    // Verify OTP
    const isValid = await verifyOTPFromDB(pool, phone, otp, user_type);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please try again.',
      });
    }

    let user;
    let tableName = user_type === 'driver' ? 'drivers' : 'users';

    // Find or create user/driver record
    const existingResult = await pool.query(
      `SELECT * FROM ${tableName} WHERE phone = $1`,
      [phone]
    );

    if (existingResult.rows.length > 0) {
      user = existingResult.rows[0];
    } else {
      // Auto-register new user/driver
      const insertResult = await pool.query(
        `INSERT INTO ${tableName} (phone) VALUES ($1) RETURNING *`,
        [phone]
      );
      user = insertResult.rows[0];
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Contact support.',
      });
    }

    // Generate JWT
    const tokenPayload = {
      id: user.id,
      phone: user.phone,
      type: user_type,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        type: user_type,
        ...(user_type === 'driver' && {
          vehicle_type: user.vehicle_type,
          vehicle_number: user.vehicle_number,
          is_verified: user.is_verified,
          rating: user.rating,
        }),
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { sendOTP, verifyOTP };
