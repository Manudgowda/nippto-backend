const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const driverRoutes = require('./routes/driverRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Nippto Backend is Running',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      auth: '/api/auth',
      user: '/api/user',
      driver: '/api/driver',
      booking: '/api/booking',
      payment: '/api/payment',
      admin: '/api/admin'
    }
  });
});

// Socket status
app.get('/socket-status', (req, res) => {
  const { getConnectedUsers } = require('./config/socket');
  const { riders, drivers } = getConnectedUsers();
  res.json({
    success: true,
    connected: {
      riders: riders.size,
      drivers: drivers.size,
      total: riders.size + drivers.size
    }
  });
});

module.exports = app;