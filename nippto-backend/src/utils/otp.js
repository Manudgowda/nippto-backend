/**
 * OTP Utility
 * Generates and manages OTPs stored in the DB
 */

/**
 * Generate a random 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Calculate OTP expiry — 5 minutes from now
 */
const getOTPExpiry = () => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 5);
  return expiry;
};

/**
 * Save OTP to database
 * Deletes any existing unused OTPs for this phone+type first
 */
const saveOTP = async (pool, phone, otp, userType) => {
  // Delete old OTPs for same phone + type
  await pool.query(
    'DELETE FROM otps WHERE phone = $1 AND user_type = $2',
    [phone, userType]
  );

  const expiresAt = getOTPExpiry();
  await pool.query(
    'INSERT INTO otps (phone, otp, user_type, expires_at) VALUES ($1, $2, $3, $4)',
    [phone, otp, userType, expiresAt]
  );
};

/**
 * Verify OTP from database
 * Returns true if valid, false otherwise
 * Marks OTP as used after successful verification
 */
const verifyOTP = async (pool, phone, otp, userType) => {
  const result = await pool.query(
    `SELECT * FROM otps 
     WHERE phone = $1 AND user_type = $2 AND otp = $3 
       AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [phone, userType, otp]
  );

  if (result.rows.length === 0) {
    return false;
  }

  // Mark as used
  await pool.query('UPDATE otps SET used = TRUE WHERE id = $1', [result.rows[0].id]);
  return true;
};

module.exports = { generateOTP, saveOTP, verifyOTP };
