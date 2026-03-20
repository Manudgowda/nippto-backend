const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const connectedRiders = new Map();
const connectedDrivers = new Map();

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error: No token'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`✅ Socket connected: ${user.type} - ${user.phone} (${socket.id})`);

    if (user.type === 'driver') {
      connectedDrivers.set(user.id, socket.id);
      console.log(`🚗 Driver registered in map: ${user.id} -> ${socket.id}`);
    } else {
      connectedRiders.set(user.id, socket.id);
      console.log(`👤 Rider registered in map: ${user.id} -> ${socket.id}`);
    }

    socket.on('driver:location_update', async (data) => {
      try {
        const { latitude, longitude, ride_id } = data;
        const pool = require('./db');
        await pool.query(
          `UPDATE drivers SET current_lat = $1, current_lng = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [latitude, longitude, user.id]
        );
        if (ride_id) {
          const rideResult = await pool.query(`SELECT user_id FROM rides WHERE id = $1`, [ride_id]);
          if (rideResult.rows.length > 0) {
            const riderId = rideResult.rows[0].user_id;
            const riderSocketId = connectedRiders.get(riderId);
            if (riderSocketId) {
              io.to(riderSocketId).emit('ride:driver_location', {
                latitude, longitude, driver_id: user.id, ride_id, timestamp: new Date()
              });
            }
          }
        }
      } catch (err) {
        console.error('driver:location_update error:', err);
      }
    });

    socket.on('driver:toggle_status', async (data) => {
      try {
        const { is_online, latitude, longitude } = data;
        const pool = require('./db');
        await pool.query(
          `UPDATE drivers SET is_online = $1, current_lat = COALESCE($2, current_lat), current_lng = COALESCE($3, current_lng), updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
          [is_online, latitude, longitude, user.id]
        );
        socket.emit('driver:status_updated', {
          is_online,
          message: `You are now ${is_online ? 'online' : 'offline'}`
        });
        console.log(`🚗 Driver ${user.phone} is now ${is_online ? 'ONLINE' : 'OFFLINE'}`);
      } catch (err) {
        console.error('driver:toggle_status error:', err);
      }
    });

    socket.on('driver:accept_ride', async (data) => {
      try {
        const { ride_id } = data;
        const pool = require('./db');
        const ride = await pool.query(`SELECT * FROM rides WHERE id = $1 AND status = 'pending'`, [ride_id]);
        if (ride.rows.length === 0) {
          socket.emit('ride:accept_failed', { message: 'Ride already taken or not available' });
          return;
        }
        const updated = await pool.query(
          `UPDATE rides SET status = 'accepted', driver_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND status = 'pending' RETURNING *`,
          [user.id, ride_id]
        );
        if (updated.rows.length === 0) {
          socket.emit('ride:accept_failed', { message: 'Ride was just taken by another driver' });
          return;
        }
        const driver = await pool.query(
          `SELECT id, name, phone, vehicle_type, vehicle_number, rating, current_lat, current_lng FROM drivers WHERE id = $1`,
          [user.id]
        );
        const acceptedRide = updated.rows[0];
        const driverData = driver.rows[0];
        socket.emit('ride:accepted_confirmed', {
          ride_id: acceptedRide.id,
          pickup_lat: acceptedRide.pickup_lat,
          pickup_lng: acceptedRide.pickup_lng,
          pickup_address: acceptedRide.pickup_address,
          drop_address: acceptedRide.drop_address,
          fare: acceptedRide.fare,
          otp: acceptedRide.otp
        });
        const riderSocketId = connectedRiders.get(acceptedRide.user_id);
        if (riderSocketId) {
          io.to(riderSocketId).emit('ride:driver_assigned', {
            ride_id: acceptedRide.id,
            driver: {
              id: driverData.id,
              name: driverData.name,
              phone: driverData.phone,
              vehicle_type: driverData.vehicle_type,
              vehicle_number: driverData.vehicle_number,
              rating: driverData.rating,
              current_lat: driverData.current_lat,
              current_lng: driverData.current_lng
            },
            message: 'Driver found! They are on the way.'
          });
        }
        console.log(`✅ Ride ${ride_id} accepted by driver ${user.phone}`);
      } catch (err) {
        console.error('driver:accept_ride error:', err);
      }
    });

    socket.on('rider:request_ride', async (data) => {
      try {
        const { pickup_lat, pickup_lng, pickup_address, drop_lat, drop_lng, drop_address, vehicle_type } = data;
        const pool = require('./db');
        const { calculateFare } = require('../utils/fareCalculator');
        const Driver = require('../models/Driver');

        const fareData = calculateFare(
          vehicle_type,
          parseFloat(pickup_lat), parseFloat(pickup_lng),
          parseFloat(drop_lat), parseFloat(drop_lng)
        );

        const rideOTP = Math.floor(1000 + Math.random() * 9000).toString();

        const result = await pool.query(
          `INSERT INTO rides (user_id, pickup_lat, pickup_lng, pickup_address, drop_lat, drop_lng, drop_address, vehicle_type, fare, distance_km, duration_min, payment_method, otp, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'cash',$12,'pending') RETURNING *`,
          [user.id, pickup_lat, pickup_lng, pickup_address || 'Pickup', drop_lat, drop_lng, drop_address || 'Drop', vehicle_type, fareData.fare, fareData.distance_km, fareData.duration_min, rideOTP]
        );

        const ride = result.rows[0];

        socket.emit('ride:requested', {
          ride_id: ride.id,
          status: 'pending',
          fare: ride.fare,
          distance_km: ride.distance_km,
          duration_min: ride.duration_min,
          otp: rideOTP,
          message: 'Looking for nearby drivers...'
        });

        const nearbyDrivers = await Driver.findNearby(
          parseFloat(pickup_lat), parseFloat(pickup_lng), vehicle_type
        );

        console.log(`📍 Found ${nearbyDrivers.length} nearby drivers`);
        console.log('🔍 Connected drivers map:', [...connectedDrivers.entries()]);
        console.log('🔍 Nearby drivers:', nearbyDrivers.map(d => ({ id: d.id, phone: d.phone })));

        nearbyDrivers.forEach(driver => {
          const driverSocketId = connectedDrivers.get(driver.id);
          console.log(`🔍 Driver ${driver.id} socket lookup: ${driverSocketId}`);
          if (driverSocketId) {
            io.to(driverSocketId).emit('ride:new_request', {
              ride_id: ride.id,
              pickup_lat: ride.pickup_lat,
              pickup_lng: ride.pickup_lng,
              pickup_address: ride.pickup_address,
              drop_address: ride.drop_address,
              fare: ride.fare,
              distance_km: ride.distance_km,
              duration_min: ride.duration_min,
              vehicle_type: ride.vehicle_type,
              distance_from_driver: driver.distance_km
            });
          }
        });

        setTimeout(async () => {
          const checkRide = await pool.query(`SELECT status FROM rides WHERE id = $1`, [ride.id]);
          if (checkRide.rows[0]?.status === 'pending') {
            await pool.query(
              `UPDATE rides SET status = 'cancelled', cancel_reason = 'No driver available' WHERE id = $1`,
              [ride.id]
            );
            socket.emit('ride:no_driver', {
              ride_id: ride.id,
              message: 'No drivers available right now. Please try again.'
            });
          }
        }, 120000);

      } catch (err) {
        console.error('rider:request_ride error:', err);
      }
    });

    socket.on('rider:cancel_ride', async (data) => {
      try {
        const { ride_id, reason } = data;
        const pool = require('./db');
        const ride = await pool.query(
          `UPDATE rides SET status = 'cancelled', cancelled_by = 'user', cancel_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 AND status IN ('pending', 'accepted') RETURNING *`,
          [reason || 'Cancelled by rider', ride_id, user.id]
        );
        if (ride.rows.length === 0) {
          socket.emit('error', { message: 'Cannot cancel this ride' });
          return;
        }
        socket.emit('ride:cancelled', { ride_id, message: 'Ride cancelled' });
        const driverId = ride.rows[0].driver_id;
        if (driverId) {
          const driverSocketId = connectedDrivers.get(driverId);
          if (driverSocketId) {
            io.to(driverSocketId).emit('ride:rider_cancelled', { ride_id, message: 'Rider cancelled the ride' });
          }
        }
      } catch (err) {
        console.error('rider:cancel_ride error:', err);
      }
    });

    socket.on('disconnect', async () => {
      console.log(`❌ Socket disconnected: ${user.type} - ${user.phone}`);
      if (user.type === 'driver') {
        connectedDrivers.delete(user.id);
        try {
          const pool = require('./db');
          await pool.query(`UPDATE drivers SET is_online = false WHERE id = $1`, [user.id]);
        } catch (err) {
          console.error('Disconnect DB update error:', err);
        }
      } else {
        connectedRiders.delete(user.id);
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

const getConnectedUsers = () => ({
  riders: connectedRiders,
  drivers: connectedDrivers
});

module.exports = { initializeSocket, getIO, getConnectedUsers };