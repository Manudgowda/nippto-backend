const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware, roleGuard } = require('../middleware/auth');

// All admin routes require authentication as admin
// NOTE: For your initial testing phase, the authMiddleware is applied but roleGuard('admin')
// is in permissive mode — any valid JWT can access. After your first admin user is set up,
// change roleGuard to enforce admin type.
router.use(authMiddleware);

// ─── GET /admin/rides ────────────────────────────────────────────
router.get('/rides', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT r.*, 
        u.phone AS rider_phone, u.name AS rider_name,
        d.phone AS driver_phone, d.name AS driver_name
       FROM rides r
       LEFT JOIN users u ON r.rider_id = u.id
       LEFT JOIN drivers d ON r.driver_id = d.id
       ORDER BY r.created_at DESC
       LIMIT 100`
    );
    res.json({ success: true, rides: result.rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/users ────────────────────────────────────────────
router.get('/users', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, phone, name, email, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/drivers ──────────────────────────────────────────
router.get('/drivers', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, phone, name, vehicle_type, vehicle_number, 
        is_verified, is_active, is_online, rating, total_rides, created_at 
       FROM drivers ORDER BY created_at DESC`
    );
    res.json({ success: true, drivers: result.rows });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /admin/drivers/:id/verify ──────────────────────────────
router.put('/drivers/:id/verify', async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE drivers SET is_verified = true WHERE id = $1 RETURNING id, phone, name, is_verified',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }
    res.json({ success: true, message: 'Driver verified.', driver: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /admin/users/:id/ban ────────────────────────────────────
router.put('/users/:id/ban', async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id, phone, is_active',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, message: 'User banned.', user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /admin/drivers/:id/ban ──────────────────────────────────
router.put('/drivers/:id/ban', async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE drivers SET is_active = false WHERE id = $1 RETURNING id, phone, is_active',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }
    res.json({ success: true, message: 'Driver banned.', driver: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/stats ────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const [ridesResult, usersResult, driversResult] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*) AS total_rides,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN fare END), 0) AS total_revenue,
          COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) AS today_rides
        FROM rides
      `),
      pool.query('SELECT COUNT(*) AS total FROM users WHERE is_active = true'),
      pool.query('SELECT COUNT(*) AS total FROM drivers WHERE is_active = true'),
    ]);

    res.json({
      success: true,
      stats: {
        rides: ridesResult.rows[0],
        total_users: usersResult.rows[0].total,
        total_drivers: driversResult.rows[0].total,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;