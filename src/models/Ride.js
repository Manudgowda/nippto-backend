const pool = require('../config/db');

class Ride {
  // Create new ride request
  static async create({
    user_id, pickup_lat, pickup_lng, pickup_address,
    drop_lat, drop_lng, drop_address, vehicle_type, fare
  }) {
    const result = await pool.query(
      `INSERT INTO rides (
        user_id, pickup_lat, pickup_lng, pickup_address,
        drop_lat, drop_lng, drop_address, vehicle_type, fare
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [user_id, pickup_lat, pickup_lng, pickup_address,
       drop_lat, drop_lng, drop_address, vehicle_type, fare]
    );
    return result.rows[0];
  }

  // Find ride by ID
  static async findById(id) {
    const result = await pool.query(
      `SELECT r.*,
              u.name as rider_name, u.phone as rider_phone,
              d.name as driver_name, d.phone as driver_phone,
              d.vehicle_number, d.rating as driver_rating
       FROM rides r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN drivers d ON r.driver_id = d.id
       WHERE r.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // Update ride status
  static async updateStatus(id, status, driver_id = null) {
    const result = await pool.query(
      `UPDATE rides 
       SET status = $1,
           driver_id = COALESCE($2, driver_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, driver_id, id]
    );
    return result.rows[0];
  }

  // Get user ride history
  static async getUserHistory(user_id) {
    const result = await pool.query(
      `SELECT r.id, r.pickup_address, r.drop_address,
              r.fare, r.status, r.vehicle_type,
              r.created_at, d.name as driver_name,
              d.vehicle_number
       FROM rides r
       LEFT JOIN drivers d ON r.driver_id = d.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [user_id]
    );
    return result.rows;
  }

  // Get driver ride history
  static async getDriverHistory(driver_id) {
    const result = await pool.query(
      `SELECT r.id, r.pickup_address, r.drop_address,
              r.fare, r.status, r.vehicle_type,
              r.created_at, u.name as rider_name
       FROM rides r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.driver_id = $1
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [driver_id]
    );
    return result.rows;
  }
}

module.exports = Ride;