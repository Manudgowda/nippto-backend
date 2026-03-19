const pool = require('../config/db');
const { generateOTP, getOTPExpiry, sendOTP } = require('../utils/otp');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// STEP 1: Send OTP to phone
const sendLoginOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || phone.length < 10) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid phone number is required' 
      });
    }

    // Invalidate old OTPs
    await pool.query(
      `UPDATE otp_verifications 
       SET is_used = true 
       WHERE phone = $1 AND is_used = false`,
      [phone]
    );

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = getOTPExpiry();

    // Save OTP to database
    await pool.query(
      `INSERT INTO otp_verifications (phone, otp, expires_at) 
       VALUES ($1, $2, $3)`,
      [phone, otp, expiresAt]
    );

    // Send OTP (console for now)
    await sendOTP(phone, otp);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      // Remove this in production!
      debug_otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });

  } catch (error) {
    console.error('sendLoginOTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// STEP 2: Verify OTP and login/register
const verifyLoginOTP = async (req, res) => {
  try {
    const { phone, otp, user_type } = req.body; // user_type: 'user' or 'driver'

    if (!phone || !otp || !user_type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone, OTP and user_type are required' 
      });
    }

    // Check OTP validity
    const otpRecord = await pool.query(
      `SELECT * FROM otp_verifications 
       WHERE phone = $1 AND otp = $2 
       AND is_used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone, otp]
    );

    if (otpRecord.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired OTP' 
      });
    }

    // Mark OTP as used
    await pool.query(
      `UPDATE otp_verifications SET is_used = true WHERE id = $1`,
      [otpRecord.rows[0].id]
    );

    let userData;
    const table = user_type === 'driver' ? 'drivers' : 'users';

    // Check if user exists
    const existingUser = await pool.query(
      `SELECT * FROM ${table} WHERE phone = $1`,
      [phone]
    );

    if (existingUser.rows.length > 0) {
      userData = existingUser.rows[0];
    } else {
      // Auto register new user
      const newUser = await pool.query(
        `INSERT INTO ${table} (phone) VALUES ($1) RETURNING *`,
        [phone]
      );
      userData = newUser.rows[0];
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: userData.id, phone: userData.phone, type: user_type },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      is_new_user: existingUser.rows.length === 0,
      token,
      user: {
        id: userData.id,
        phone: userData.phone,
        name: userData.name,
        type: user_type
      }
    });

  } catch (error) {
    console.error('verifyLoginOTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { sendLoginOTP, verifyLoginOTP };