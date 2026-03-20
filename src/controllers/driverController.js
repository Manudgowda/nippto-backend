const pool = require('../config/db');

// Get driver profile
const getDriverProfile = async (req, res) => {
  try {
    const driverId = req.user.id;

    const result = await pool.query(
      `SELECT id, phone, name, email, profile_picture,
              vehicle_type, vehicle_number, license_number,
              is_verified, is_active, is_online,
              rating, total_rides, created_at
       FROM drivers WHERE id = $1`,
      [driverId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    res.status(200).json({
      success: true,
      driver: result.rows[0]
    });

  } catch (error) {
    console.error('getDriverProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update driver profile
const updateDriverProfile = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { name, email, vehicle_type, vehicle_number, license_number } = req.body;

    // Validate vehicle type
    if (vehicle_type && !['bike', 'auto'].includes(vehicle_type)) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle type must be bike or auto'
      });
    }

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
      [name, email, vehicle_type, vehicle_number, license_number, driverId]
    );

    res.status(200).json({
      success: true,
      message: 'Driver profile updated successfully',
      driver: result.rows[0]
    });

  } catch (error) {
    console.error('updateDriverProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Toggle driver online/offline
const toggleDriverStatus = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { is_online, current_lat, current_lng } = req.body;

    if (typeof is_online !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_online must be true or false'
      });
    }

    // If going online, location is required
    if (is_online && (!current_lat || !current_lng)) {
      return res.status(400).json({
        success: false,
        message: 'Location required when going online'
      });
    }

    const result = await pool.query(
      `UPDATE drivers 
       SET is_online = $1,
           current_lat = COALESCE($2, current_lat),
           current_lng = COALESCE($3, current_lng),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, phone, name, is_online, current_lat, current_lng`,
      [is_online, current_lat, current_lng, driverId]
    );

    res.status(200).json({
      success: true,
      message: `Driver is now ${is_online ? 'online' : 'offline'}`,
      driver: result.rows[0]
    });

  } catch (error) {
    console.error('toggleDriverStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update driver live location
const updateDriverLocation = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { current_lat, current_lng } = req.body;

    if (!current_lat || !current_lng) {
      return res.status(400).json({
        success: false,
        message: 'current_lat and current_lng are required'
      });
    }

    await pool.query(
      `UPDATE drivers 
       SET current_lat = $1,
           current_lng = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [current_lat, current_lng, driverId]
    );

    res.status(200).json({
      success: true,
      message: 'Location updated'
    });

  } catch (error) {
    console.error('updateDriverLocation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getDriverProfile,
  updateDriverProfile,
  toggleDriverStatus,
  updateDriverLocation
};