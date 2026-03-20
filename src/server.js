const http = require('http');
const app = require('./app');
const pool = require('./config/db');
const { initializeSocket } = require('./config/socket');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = initializeSocket(server);

// Start server
server.listen(PORT, async () => {
  console.log(`✅ Nippto server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`⚡ WebSocket server ready`);

  // Test DB connection
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection confirmed');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }
});

module.exports = { server, io };