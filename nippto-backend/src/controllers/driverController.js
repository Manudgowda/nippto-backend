const pool = require('../config/db');

/**
 * GET /api/driver/profile
 * Returns authenticated driver's profile
 */
const getProfile = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, phone, name, vehicle_type, vehicle_number, is_verified, is_active, is_online, rating, total_rides, created_at FROM drivers WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }

    return res.json({ success: true, driver: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/driver/rides
 * Returns ride history for the authenticated driver
 */
const getRideHistory = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.phone AS rider_phone, u.name AS rider_name
       FROM rides r
       LEFT JOIN users u ON r.rider_id = u.id
       WHERE r.driver_id = $1
       ORDER BY r.created_at DESC LIMIT 50`,
      [req.user.id]
    );

    return res.json({ success: true, rides: result.rows });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/driver/profile
 * Update driver name / vehicle info
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, vehicle_type, vehicle_number } = req.body;
    const result = await pool.query(
      `UPDATE drivers SET 
        name = COALESCE($1, name),
        vehicle_type = COALESCE($2, vehicle_type),
        vehicle_number = COALESCE($3, vehicle_number)
       WHERE id = $4 RETURNING id, phone, name, vehicle_type, vehicle_number, rating`,
      [name, vehicle_type, vehicle_number, req.user.id]
    );

    return res.json({ success: true, driver: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/driver/earnings
 * Returns earnings summary for the authenticated driver
 */
const getEarnings = async (req, res, next) => {
  try {
    const driverId = req.user.id;

    const result = await pool.query(
      `SELECT
        COALESCE(SUM(fare), 0) AS total,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN fare ELSE 0 END), 0) AS today,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN fare ELSE 0 END), 0) AS this_week,
        COUNT(*) AS total_rides,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) AS today_rides
       FROM rides
       WHERE driver_id = $1 AND status = 'completed'`,
      [driverId]
    );

    return res.json({ success: true, earnings: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, getRideHistory, updateProfile, getEarnings };
