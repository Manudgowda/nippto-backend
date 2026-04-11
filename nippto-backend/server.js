require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const pool = require('./src/config/db');

// ─── Routes ──────────────────────────────────────────────────
const authRoutes = require('./src/routes/authRoutes');
const bookingRoutes = require('./src/routes/bookingRoutes');
const driverRoutes = require('./src/routes/driverRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

// ─── Error Handlers ──────────────────────────────────────────
const { errorHandler, notFound } = require('./src/middleware/errorHandler');

// ─── App Setup ───────────────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);

// ─── Socket.IO Setup ─────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// ─── Express Middleware ──────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Static Files (Demo UI) ──────────────────────────────────
app.use('/demo', express.static('frontend-demo'));

// ─── Health Check ────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Nippto Backend is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ─── API Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/booking', bookingRoutes);
app.use('/api/driver', driverRoutes);
app.use('/admin', adminRoutes);

// ─── 404 + Global Error Handler ──────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── In-Memory Maps (Socket sessions) ────────────────────────
// Maps: driverId → { socketId, isOnline, latitude, longitude, vehicleType }
// Maps: riderId  → { socketId }
const driverSockets = new Map();
const riderSockets = new Map();

// ─── Socket.IO Auth Middleware ────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication token required'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // { id, phone, type }
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
});

// ─── Socket.IO Connection Handler ────────────────────────────
io.on('connection', (socket) => {
  const { id: userId, type: userType, phone } = socket.user;
  console.log(`🔌 ${userType} connected: ${phone} (${socket.id})`);

  // Register socket
  if (userType === 'driver') {
    driverSockets.set(userId, { socketId: socket.id, isOnline: false, latitude: null, longitude: null });
  } else if (userType === 'user') {
    riderSockets.set(userId, { socketId: socket.id });
  }

  // ── DRIVER EVENTS ─────────────────────────────────────────

  /**
   * Driver goes online/offline + updates location
   * Payload: { is_online, latitude, longitude }
   */
  socket.on('driver:toggle_status', async ({ is_online, latitude, longitude }) => {
    try {
      await pool.query(
        'UPDATE drivers SET is_online = $1, latitude = $2, longitude = $3 WHERE id = $4',
        [is_online, latitude, longitude, userId]
      );

      // Update in-memory map
      const entry = driverSockets.get(userId) || {};
      driverSockets.set(userId, { ...entry, socketId: socket.id, isOnline: is_online, latitude, longitude });

      socket.emit('driver:status_updated', { is_online, latitude, longitude });
      console.log(`🚗 Driver ${phone} is now ${is_online ? 'ONLINE' : 'OFFLINE'}`);
    } catch (err) {
      socket.emit('error', { message: 'Failed to update status.' });
      console.error('driver:toggle_status error:', err.message);
    }
  });

  /**
   * Driver updates location while online
   * Payload: { latitude, longitude }
   */
  socket.on('driver:update_location', async ({ latitude, longitude }) => {
    try {
      await pool.query(
        'UPDATE drivers SET latitude = $1, longitude = $2 WHERE id = $3',
        [latitude, longitude, userId]
      );
      const entry = driverSockets.get(userId) || {};
      driverSockets.set(userId, { ...entry, latitude, longitude });
    } catch (err) {
      console.error('driver:update_location error:', err.message);
    }
  });

  /**
   * Driver accepts a ride
   * Payload: { ride_id }
   */
  socket.on('driver:accept_ride', async ({ ride_id }) => {
    try {
      // Check ride is still pending
      const rideResult = await pool.query(
        'SELECT * FROM rides WHERE id = $1 AND status = $2',
        [ride_id, 'pending']
      );

      if (rideResult.rows.length === 0) {
        socket.emit('error', { message: 'Ride no longer available.' });
        return;
      }

      const ride = rideResult.rows[0];

      // Get driver info
      const driverResult = await pool.query(
        'SELECT name, phone, vehicle_type, vehicle_number, rating FROM drivers WHERE id = $1',
        [userId]
      );
      const driver = driverResult.rows[0];

      // Update ride
      await pool.query(
        'UPDATE rides SET driver_id = $1, status = $2, driver_name = $3 WHERE id = $4',
        [userId, 'accepted', driver?.name || 'Driver', ride_id]
      );

      // Go offline (driver is now busy)
      await pool.query('UPDATE drivers SET is_online = false WHERE id = $1', [userId]);
      const entry = driverSockets.get(userId) || {};
      driverSockets.set(userId, { ...entry, isOnline: false });

      // Confirm to driver
      socket.emit('ride:accepted_confirmed', {
        ride_id,
        pickup_address: ride.pickup_address,
        drop_address: ride.drop_address,
        otp: ride.otp,
        fare: ride.fare,
        rider_id: ride.rider_id,
      });

      // Notify rider
      const riderEntry = riderSockets.get(ride.rider_id.toString());
      if (riderEntry) {
        io.to(riderEntry.socketId).emit('ride:driver_assigned', {
          ride_id,
          driver: {
            name: driver?.name || 'Driver',
            phone: driver?.phone,
            vehicle_type: driver?.vehicle_type,
            vehicle_number: driver?.vehicle_number,
            rating: driver?.rating,
          },
        });
      }

      console.log(`✅ Ride ${ride_id} accepted by driver ${phone}`);
    } catch (err) {
      socket.emit('error', { message: 'Failed to accept ride.' });
      console.error('driver:accept_ride error:', err.message);
    }
  });

  /**
   * Driver marks ride as started (after OTP verification)
   * Payload: { ride_id, otp }
   */
  socket.on('driver:start_ride', async ({ ride_id, otp }) => {
    try {
      const result = await pool.query(
        'SELECT * FROM rides WHERE id = $1 AND driver_id = $2 AND status = $3',
        [ride_id, userId, 'accepted']
      );

      if (result.rows.length === 0) {
        socket.emit('error', { message: 'Ride not found.' });
        return;
      }

      const ride = result.rows[0];
      if (ride.otp !== otp) {
        socket.emit('error', { message: 'Invalid OTP.' });
        return;
      }

      await pool.query('UPDATE rides SET status = $1 WHERE id = $2', ['started', ride_id]);

      socket.emit('ride:started', { ride_id });

      const riderEntry = riderSockets.get(ride.rider_id.toString());
      if (riderEntry) {
        io.to(riderEntry.socketId).emit('ride:started', { ride_id });
      }
    } catch (err) {
      socket.emit('error', { message: 'Failed to start ride.' });
      console.error('driver:start_ride error:', err.message);
    }
  });

  /**
   * Driver completes a ride
   * Payload: { ride_id }
   */
  socket.on('driver:complete_ride', async ({ ride_id }) => {
    try {
      const result = await pool.query(
        `UPDATE rides SET status = 'completed' 
         WHERE id = $1 AND driver_id = $2 AND status = 'started'
         RETURNING *`,
        [ride_id, userId]
      );

      if (result.rows.length === 0) {
        socket.emit('error', { message: 'Cannot complete this ride.' });
        return;
      }

      const ride = result.rows[0];

      // Update driver stats
      await pool.query(
        'UPDATE drivers SET total_rides = total_rides + 1, is_online = true WHERE id = $1',
        [userId]
      );
      const entry = driverSockets.get(userId) || {};
      driverSockets.set(userId, { ...entry, isOnline: true });

      socket.emit('ride:completed', { ride_id, fare: ride.fare });

      const riderEntry = riderSockets.get(ride.rider_id.toString());
      if (riderEntry) {
        io.to(riderEntry.socketId).emit('ride:completed', { ride_id, fare: ride.fare });
      }

      console.log(`🏁 Ride ${ride_id} completed. Fare: ₹${ride.fare}`);
    } catch (err) {
      socket.emit('error', { message: 'Failed to complete ride.' });
      console.error('driver:complete_ride error:', err.message);
    }
  });

  // ── RIDER EVENTS ──────────────────────────────────────────

  /**
   * Rider requests a ride via Socket (alternative to REST API)
   * Payload: { pickup_lat, pickup_lng, drop_lat, drop_lng, pickup_address, drop_address, vehicle_type }
   */
  socket.on('rider:request_ride', async (data) => {
    try {
      const { pickup_lat, pickup_lng, drop_lat, drop_lng, pickup_address = '', drop_address = '', vehicle_type = 'bike' } = data;
      const { calculateFare } = require('./src/utils/fare');

      const fareData = calculateFare(
        parseFloat(pickup_lat), parseFloat(pickup_lng),
        parseFloat(drop_lat), parseFloat(drop_lng),
        vehicle_type
      );

      const rideOtp = Math.floor(1000 + Math.random() * 9000).toString();

      const result = await pool.query(
        `INSERT INTO rides 
          (rider_id, pickup_lat, pickup_lng, pickup_address, drop_lat, drop_lng, drop_address,
           vehicle_type, fare, distance_km, duration_min, otp, payment_method, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'cash', 'pending')
         RETURNING *`,
        [userId, pickup_lat, pickup_lng, pickup_address, drop_lat, drop_lng, drop_address,
         vehicle_type, fareData.fare, fareData.distance_km, fareData.duration_min, rideOtp]
      );

      const ride = result.rows[0];

      // Notify rider that ride was created
      socket.emit('ride:requested', {
        ride_id: ride.id,
        fare: ride.fare,
        otp: ride.otp,
        distance_km: ride.distance_km,
        duration_min: ride.duration_min,
      });

      // Broadcast to available online drivers with matching vehicle type
      let driversNotified = 0;
      for (const [driverId, driverData] of driverSockets.entries()) {
        if (driverData.isOnline) {
          try {
            // Check driver vehicle type in DB
            const driverResult = await pool.query(
              'SELECT vehicle_type FROM drivers WHERE id = $1 AND is_active = true',
              [driverId]
            );
            if (driverResult.rows.length > 0) {
              const dbVehicleType = driverResult.rows[0].vehicle_type;
              // Broadcast to all online drivers (or filter by vehicle type)
              io.to(driverData.socketId).emit('ride:new_request', {
                ride_id: ride.id,
                pickup_lat,
                pickup_lng,
                pickup_address,
                drop_address,
                fare: ride.fare,
                distance_km: ride.distance_km,
                vehicle_type,
              });
              driversNotified++;
            }
          } catch (e) {
            console.error('Error notifying driver:', e.message);
          }
        }
      }

      console.log(`📡 Ride ${ride.id} broadcast to ${driversNotified} online driver(s)`);
    } catch (err) {
      socket.emit('error', { message: 'Failed to request ride.' });
      console.error('rider:request_ride error:', err.message);
    }
  });

  // ── DISCONNECT ────────────────────────────────────────────

  socket.on('disconnect', async () => {
    console.log(`🔌 ${userType} disconnected: ${phone}`);

    if (userType === 'driver') {
      driverSockets.delete(userId);
      // Mark driver offline in DB
      try {
        await pool.query('UPDATE drivers SET is_online = false WHERE id = $1', [userId]);
      } catch (e) {
        console.error('Failed to mark driver offline:', e.message);
      }
    } else if (userType === 'user') {
      riderSockets.delete(userId);
    }
  });
});

// ─── Also: When a ride is created via REST /booking/request,
//     broadcast to online drivers via Socket.IO
// This allows the REST API booking to work in sync with real-time
const broadcastRideToDrivers = async (ride) => {
  let count = 0;
  for (const [driverId, driverData] of driverSockets.entries()) {
    if (driverData.isOnline) {
      io.to(driverData.socketId).emit('ride:new_request', {
        ride_id: ride.id,
        pickup_lat: ride.pickup_lat,
        pickup_lng: ride.pickup_lng,
        pickup_address: ride.pickup_address,
        drop_address: ride.drop_address,
        fare: ride.fare,
        distance_km: ride.distance_km,
        vehicle_type: ride.vehicle_type,
      });
      count++;
    }
  }
  return count;
};

// Export io and broadcast helper for use in controllers
app.set('io', io);
app.set('driverSockets', driverSockets);
app.set('riderSockets', riderSockets);
app.set('broadcastRideToDrivers', broadcastRideToDrivers);

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Nippto Backend running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`📡 Socket.IO enabled`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health\n`);
});

module.exports = { app, io };
