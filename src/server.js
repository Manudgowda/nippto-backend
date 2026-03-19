const app = require('./app');
const pool = require('./config/db');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`✅ Nippto server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  
  // Test DB connection
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection confirmed');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }
});