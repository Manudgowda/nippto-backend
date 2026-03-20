const pool = require('../config/db');
const { calculateFare } = require('../utils/fareCalculator');
const Driver = require('../models/Driver');
const Ride = require('../models/Ride');

// 1. Get fare estimate (before booking)
const getFareEstimate = async (req, res) => {
  try {
    const {
      pickup_lat, pickup_lng,
      drop_lat, drop_lng,
      vehicle_type
    } = req.body;

    if (!pickup_lat || !pickup_lng || !drop_lat || !drop_lng || !vehicle_type) {
      return res.status(400).json({
        success: false,
        message: 'pickup, drop coordinates and vehicle_type are required'
      });
    }

    if (!['bike', 'auto'].includes(vehicle_type)) {
      return res.status(400).json({
        success: false,
        message: 'vehicle_type must be bike or auto'
      });
    }

    const estimate = calculateFare(
      vehicle_type,
      parseFloat(pickup_lat),
      parseFloat(pickup_lng),
      parseFloat(drop_lat),
      parseFloat(drop_lng)
    );

    // Check nearby drivers availability
    const nearbyDrivers = await Driver.findNearby(
      parseFloat(pickup_lat),
      parseFloat(pickup_lng),
      vehicle_type
    );

    res.status(200).json({
      success: true,
      estimate: {
        ...estimate,
        drivers_available: nearbyDrivers.length,
        surge_active: false
      }
    });

  } catch (error) {
    console.error('getFareEstimate error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 2. Create ride request
const createRideRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      pickup_lat, pickup_lng, pickup_address,
      drop_lat, drop_lng, drop_address,
      vehicle_type, payment_method
    } = req.body;

    if (!pickup_lat || !pickup_lng || !drop_lat || !drop_lng || !vehicle_type) {
      return res.status(400).json({
        success: false,
        message: 'All location fields and vehicle_type are required'
      });
    }

    // Check if user has active ride already
    const activeRide = await pool.query(
      `SELECT id FROM rides 
       WHERE user_id = $1 
       AND status IN ('pending', 'accepted', 'started')`,
      [userId]
    );

    if (activeRide.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active ride',
        ride_id: activeRide.rows[0].id
      });
    }

    // Calculate fare
    const fareData = calculateFare(
      vehicle_type,
      parseFloat(pickup_lat),
      parseFloat(pickup_lng),
      parseFloat(drop_lat),
      parseFloat(drop_lng)
    );

    // Generate ride OTP (4 digit for pickup confirmation)
    const rideOTP = Math.floor(1000 + Math.random() * 9000).toString();

    // Create ride in database
    const result = await pool.query(
      `INSERT INTO rides (
        user_id, pickup_lat, pickup_lng, pickup_address,
        drop_lat, drop_lng, drop_address,
        vehicle_type, fare, distance_km, duration_min,
        payment_method, otp, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')
      RETURNING *`,
      [
        userId,
        pickup_lat, pickup_lng,
        pickup_address || 'Pickup Location',
        drop_lat, drop_lng,
        drop_address || 'Drop Location',
        vehicle_type,
        fareData.fare,
        fareData.distance_km,
        fareData.duration_min,
        payment_method || 'cash',
        rideOTP
      ]
    );

    const ride = result.rows[0];

    // Find nearby drivers
    const nearbyDrivers = await Driver.findNearby(
      parseFloat(pickup_lat),
      parseFloat(pickup_lng),
      vehicle_type
    );

    res.status(201).json({
      success: true,
      message: 'Ride requested successfully',
      ride: {
        id: ride.id,
        status: ride.status,
        pickup_address: ride.pickup_address,
        drop_address: ride.drop_address,
        vehicle_type: ride.vehicle_type,
        fare: ride.fare,
        distance_km: ride.distance_km,
        duration_min: ride.duration_min,
        payment_method: ride.payment_method,
        otp: rideOTP,
        drivers_notified: nearbyDrivers.length
      }
    });

  } catch (error) {
    console.error('createRideRequest error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 3. Driver accepts ride
const acceptRide = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { ride_id } = req.body;

    if (!ride_id) {
      return res.status(400).json({
        success: false,
        message: 'ride_id is required'
      });
    }

    // Check if driver already has active ride
    const driverActiveRide = await pool.query(
      `SELECT id FROM rides 
       WHERE driver_id = $1 
       AND status IN ('accepted', 'started')`,
      [driverId]
    );

    if (driverActiveRide.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active ride'
      });
    }

    // Check if ride is still pending
    const ride = await pool.query(
      `SELECT * FROM rides WHERE id = $1 AND status = 'pending'`,
      [ride_id]
    );

    if (ride.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ride not available or already taken'
      });
    }

    // Accept the ride
    const updatedRide = await pool.query(
      `UPDATE rides 
       SET status = 'accepted',
           driver_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [driverId, ride_id]
    );

    if (updatedRide.rows.length === 0) {
      return res.status(409).json({
        success: false,
        message: 'Ride was just taken by another driver'
      });
    }

    const acceptedRide = updatedRide.rows[0];

    res.status(200).json({
      success: true,
      message: 'Ride accepted successfully',
      ride: {
        id: acceptedRide.id,
        status: acceptedRide.status,
        pickup_lat: acceptedRide.pickup_lat,
        pickup_lng: acceptedRide.pickup_lng,
        pickup_address: acceptedRide.pickup_address,
        drop_address: acceptedRide.drop_address,
        fare: acceptedRide.fare,
        distance_km: acceptedRide.distance_km,
        payment_method: acceptedRide.payment_method
      }
    });

  } catch (error) {
    console.error('acceptRide error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 4. Start ride (driver confirms OTP)
const startRide = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { ride_id, otp } = req.body;

    if (!ride_id || !otp) {
      return res.status(400).json({
        success: false,
        message: 'ride_id and otp are required'
      });
    }

    // Verify ride ownership
    const ride = await pool.query(
      `SELECT * FROM rides 
       WHERE id = $1 
       AND driver_id = $2 
       AND status = 'accepted'`,
      [ride_id, driverId]
    );

    if (ride.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found or not assigned to you'
      });
    }

    // Check OTP
    if (ride.rows[0].otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Ask rider for correct OTP.'
      });
    }

    // Start the ride
    const updatedRide = await pool.query(
      `UPDATE rides 
       SET status = 'started',
           started_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [ride_id]
    );

    res.status(200).json({
      success: true,
      message: 'Ride started! Have a safe trip 🚀',
      ride: {
        id: updatedRide.rows[0].id,
        status: updatedRide.rows[0].status,
        started_at: updatedRide.rows[0].started_at,
        drop_address: updatedRide.rows[0].drop_address,
        fare: updatedRide.rows[0].fare
      }
    });

  } catch (error) {
    console.error('startRide error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 5. Complete ride
const completeRide = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { ride_id } = req.body;

    if (!ride_id) {
      return res.status(400).json({
        success: false,
        message: 'ride_id is required'
      });
    }

    const ride = await pool.query(
      `SELECT * FROM rides 
       WHERE id = $1 
       AND driver_id = $2 
       AND status = 'started'`,
      [ride_id, driverId]
    );

    if (ride.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active ride not found'
      });
    }

    // Complete ride
    const updatedRide = await pool.query(
      `UPDATE rides 
       SET status = 'completed',
           completed_at = CURRENT_TIMESTAMP,
           payment_status = 'completed',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [ride_id]
    );

    // Update driver total rides
    await pool.query(
      `UPDATE drivers 
       SET total_rides = total_rides + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [driverId]
    );

    const completedRide = updatedRide.rows[0];

    res.status(200).json({
      success: true,
      message: 'Ride completed successfully! 🎉',
      ride: {
        id: completedRide.id,
        status: completedRide.status,
        fare: completedRide.fare,
        distance_km: completedRide.distance_km,
        payment_method: completedRide.payment_method,
        payment_status: completedRide.payment_status,
        started_at: completedRide.started_at,
        completed_at: completedRide.completed_at
      }
    });

  } catch (error) {
    console.error('completeRide error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 6. Cancel ride
const cancelRide = async (req, res) => {
  try {
    const { ride_id, reason } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;

    if (!ride_id) {
      return res.status(400).json({
        success: false,
        message: 'ride_id is required'
      });
    }

    const whereClause = userType === 'driver'
      ? `id = $1 AND driver_id = $2 AND status IN ('accepted','started')`
      : `id = $1 AND user_id = $2 AND status IN ('pending','accepted')`;

    const ride = await pool.query(
      `SELECT * FROM rides WHERE ${whereClause}`,
      [ride_id, userId]
    );

    if (ride.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found or cannot be cancelled'
      });
    }

    await pool.query(
      `UPDATE rides 
       SET status = 'cancelled',
           cancelled_by = $1,
           cancel_reason = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [userType, reason || 'No reason provided', ride_id]
    );

    res.status(200).json({
      success: true,
      message: 'Ride cancelled successfully'
    });

  } catch (error) {
    console.error('cancelRide error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 7. Get ride details
const getRideDetails = async (req, res) => {
  try {
    const { ride_id } = req.params;

    const ride = await Ride.findById(ride_id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    res.status(200).json({
      success: true,
      ride
    });

  } catch (error) {
    console.error('getRideDetails error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 8. Get ride history
const getRideHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.type;

    const rides = userType === 'driver'
      ? await Ride.getDriverHistory(userId)
      : await Ride.getUserHistory(userId);

    res.status(200).json({
      success: true,
      count: rides.length,
      rides
    });

  } catch (error) {
    console.error('getRideHistory error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getFareEstimate,
  createRideRequest,
  acceptRide,
  startRide,
  completeRide,
  cancelRide,
  getRideDetails,
  getRideHistory
};