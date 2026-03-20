const pool = require('../config/db');

const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, phone, name, email, profile_picture, 
              is_active, created_at 
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    console.error('getUserProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    if (!name && !email) {
      return res.status(400).json({
        success: false,
        message: 'At least name or email is required'
      });
    }

    const result = await pool.query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, phone, name, email, profile_picture`,
      [name, email, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('updateUserProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getUserProfile, updateUserProfile };