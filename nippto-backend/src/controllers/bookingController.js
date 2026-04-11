const pool = require('../config/db');
const { calculateFare } = require('../utils/fare');

/**
 * POST /booking/estimate
 * Body: { pickup_lat, pickup_lng, drop_lat, drop_lng, vehicle_type }
 * Returns fare estimate — no ride created yet
 */
const getFareEstimate = async (req, res, next) => {
  try {
    const { pickup_lat, pickup_lng, drop_lat, drop_lng, vehicle_type = 'bike' } = req.body;

    if (!pickup_lat || !pickup_lng || !drop_lat || !drop_lng) {
      return res.status(400).json({
        success: false,
        message: 'Pickup and drop coordinates are required.',
      });
    }

    const estimate = calculateFare(
      parseFloat(pickup_lat),
      parseFloat(pickup_lng),
      parseFloat(drop_lat),
      parseFloat(drop_lng),
      vehicle_type
    );

    return res.json({
      success: true,
      estimate,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /booking/request
 * Body: { pickup_lat, pickup_lng, pickup_address, drop_lat, drop_lng, drop_address, vehicle_type, payment_method }
 * Creates a ride record and returns ride_id + OTP
 */
const requestRide = async (req, res, next) => {
  try {
    const {
      pickup_lat,
      pickup_lng,
      pickup_address = '',
      drop_lat,
      drop_lng,
      drop_address = '',
      vehicle_type = 'bike',
      payment_method = 'cash',
    } = req.body;

    const riderId = req.user.id;

    if (!pickup_lat || !pickup_lng || !drop_lat || !drop_lng) {
      return res.status(400).json({
        success: false,
        message: 'Pickup and drop coordinates are required.',
      });
    }

    // Calculate fare
    const fareData = calculateFare(
      parseFloat(pickup_lat),
      parseFloat(pickup_lng),
      parseFloat(drop_lat),
      parseFloat(drop_lng),
      vehicle_type
    );

    // Generate 4-digit OTP for driver-rider handshake
    const rideOtp = Math.floor(1000 + Math.random() * 9000).toString();

    // Insert ride
    const result = await pool.query(
      `INSERT INTO rides 
        (rider_id, pickup_lat, pickup_lng, pickup_address, drop_lat, drop_lng, drop_address,
         vehicle_type, fare, distance_km, duration_min, otp, payment_method, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
       RETURNING *`,
      [
        riderId,
        pickup_lat,
        pickup_lng,
        pickup_address,
        drop_lat,
        drop_lng,
        drop_address,
        vehicle_type,
        fareData.fare,
        fareData.distance_km,
        fareData.duration_min,
        rideOtp,
        payment_method,
      ]
    );

    const ride = result.rows[0];

    return res.json({
      success: true,
      message: 'Ride requested successfully. Searching for drivers...',
      ride: {
        id: ride.id,
        fare: ride.fare,
        otp: ride.otp,
        distance_km: ride.distance_km,
        duration_min: ride.duration_min,
        vehicle_type: ride.vehicle_type,
        status: ride.status,
        pickup_address: ride.pickup_address,
        drop_address: ride.drop_address,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /booking/history
 * Returns all rides for the authenticated rider
 */
const getRideHistory = async (req, res, next) => {
  try {
    const riderId = req.user.id;

    const result = await pool.query(
      `SELECT 
        r.*,
        d.name AS driver_name,
        d.vehicle_number,
        d.rating AS driver_rating
       FROM rides r
       LEFT JOIN drivers d ON r.driver_id = d.id
       WHERE r.rider_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [riderId]
    );

    return res.json({
      success: true,
      rides: result.rows,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /booking/active
 * Returns the current active ride for the authenticated rider (if any)
 */
const getActiveRide = async (req, res, next) => {
  try {
    const riderId = req.user.id;

    const result = await pool.query(
      `SELECT 
        r.*,
        d.name AS driver_name,
        d.phone AS driver_phone,
        d.vehicle_number,
        d.vehicle_type AS driver_vehicle_type,
        d.rating AS driver_rating
       FROM rides r
       LEFT JOIN drivers d ON r.driver_id = d.id
       WHERE r.rider_id = $1 AND r.status IN ('pending', 'accepted', 'started')
       ORDER BY r.created_at DESC LIMIT 1`,
      [riderId]
    );

    return res.json({
      success: true,
      ride: result.rows[0] || null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /booking/cancel/:rideId
 * Rider cancels a pending ride
 */
const cancelRide = async (req, res, next) => {
  try {
    const riderId = req.user.id;
    const { rideId } = req.params;

    const result = await pool.query(
      `UPDATE rides SET status = 'cancelled'
       WHERE id = $1 AND rider_id = $2 AND status = 'pending'
       RETURNING *`,
      [rideId, riderId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Ride not found or cannot be cancelled.',
      });
    }

    return res.json({ success: true, message: 'Ride cancelled.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getFareEstimate, requestRide, getRideHistory, getActiveRide, cancelRide };
