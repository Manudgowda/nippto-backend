const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/rides', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rides ORDER BY created_at DESC');
    res.json({ success: true, rides: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    res.json({ success: true, users: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/drivers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM drivers ORDER BY created_at DESC');
    res.json({ success: true, drivers: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/drivers/:id/verify', async (req, res) => {
  try {
    await pool.query('UPDATE drivers SET is_verified = true WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Driver verified' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/users/:id/ban', async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'User banned' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/drivers/:id/ban', async (req, res) => {
  try {
    await pool.query('UPDATE drivers SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Driver banned' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;