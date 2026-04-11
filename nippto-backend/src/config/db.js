const { Pool } = require('pg');

// Railway internal URLs (postgres.railway.internal) don't need SSL
// Railway external URLs (proxy.rlwy.net) need SSL
const connectionString = process.env.DATABASE_URL;
const isInternalRailway = connectionString && connectionString.includes('railway.internal');

const pool = new Pool({
  connectionString,
  ssl: isInternalRailway
    ? false
    : process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('🔴 Unexpected DB pool error:', err.message);
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('🔴 Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected successfully');
    release();
  }
});

module.exports = pool;
