const pool = require('../config/db');

class User {
  // Find user by ID
  static async findById(id) {
    const result = await pool.query(
      `SELECT id, phone, name, email, profile_picture, 
              is_active, created_at 
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // Find user by phone
  static async findByPhone(phone) {
    const result = await pool.query(
      `SELECT * FROM users WHERE phone = $1`,
      [phone]
    );
    return result.rows[0] || null;
  }

  // Create new user
  static async create(phone) {
    const result = await pool.query(
      `INSERT INTO users (phone) 
       VALUES ($1) RETURNING *`,
      [phone]
    );
    return result.rows[0];
  }

  // Update user
  static async update(id, { name, email, profile_picture }) {
    const result = await pool.query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           profile_picture = COALESCE($3, profile_picture),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, phone, name, email, profile_picture`,
      [name, email, profile_picture, id]
    );
    return result.rows[0];
  }

  // Deactivate user
  static async deactivate(id) {
    const result = await pool.query(
      `UPDATE users SET is_active = false 
       WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0];
  }
}

module.exports = User;