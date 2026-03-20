const pool = require('../config/db');

class Driver {
  // Find driver by ID
  static async findById(id) {
    const result = await pool.query(
      `SELECT id, phone, name, email, profile_picture,
              vehicle_type, vehicle_number, license_number,
              is_verified, is_active, is_online,
              current_lat, current_lng,
              rating, total_rides, created_at
       FROM drivers WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // Find driver by phone
  static async findByPhone(phone) {
    const result = await pool.query(
      `SELECT * FROM drivers WHERE phone = $1`,
      [phone]
    );
    return result.rows[0] || null;
  }

  // Create new driver
  static async create(phone) {
    const result = await pool.query(
      `INSERT INTO drivers (phone) 
       VALUES ($1) RETURNING *`,
      [phone]
    );
    return result.rows[0];
  }

  // Update driver profile
  static async update(id, { name, email, vehicle_type, vehicle_number, license_number }) {
    const result = await pool.query(
      `UPDATE drivers 
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           vehicle_type = COALESCE($3, vehicle_type),
           vehicle_number = COALESCE($4, vehicle_number),
           license_number = COALESCE($5, license_number),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, phone, name, email, vehicle_type,
                 vehicle_number, license_number, is_verified`,
      [name, email, vehicle_type, vehicle_number, license_number, id]
    );
    return result.rows[0];
  }

  // Update driver location
  static async updateLocation(id, lat, lng) {
    const result = await pool.query(
      `UPDATE drivers 
       SET current_lat = $1,
           current_lng = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, current_lat, current_lng`,
      [lat, lng, id]
    );
    return result.rows[0];
  }

  // Find nearby online drivers
 static async findNearby(lat, lng, vehicle_type, radiusKm = 5) {
  const result = await pool.query(
    `SELECT id, name, phone, vehicle_type, vehicle_number,
            rating, current_lat, current_lng,
            (6371 * acos(
              cos(radians($1)) * cos(radians(current_lat)) *
              cos(radians(current_lng) - radians($2)) +
              sin(radians($1)) * sin(radians(current_lat))
            )) AS distance_km
     FROM drivers
     WHERE is_online = true
       AND is_verified = true
       AND is_active = true
       AND vehicle_type = $3
       AND current_lat IS NOT NULL
       AND current_lng IS NOT NULL
       AND (6371 * acos(
              cos(radians($1)) * cos(radians(current_lat)) *
              cos(radians(current_lng) - radians($2)) +
              sin(radians($1)) * sin(radians(current_lat))
            )) < $4
     ORDER BY distance_km ASC
     LIMIT 10`,
    [lat, lng, vehicle_type, radiusKm]
  );
  return result.rows;
}

  // Toggle online status
  static async toggleStatus(id, is_online, lat = null, lng = null) {
    const result = await pool.query(
      `UPDATE drivers 
       SET is_online = $1,
           current_lat = COALESCE($2, current_lat),
           current_lng = COALESCE($3, current_lng),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, name, is_online, current_lat, current_lng`,
      [is_online, lat, lng, id]
    );
    return result.rows[0];
  }
}

module.exports = Driver;