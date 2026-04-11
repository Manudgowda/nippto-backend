/**
 * Database Initialization Script
 * Run once: node scripts/initDb.js
 * This creates all required tables in Railway PostgreSQL
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

const schemaPath = path.join(__dirname, '../src/config/schema.sql');

async function initDb() {
  console.log('🔄 Initializing database schema...');
  try {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schema);
    console.log('✅ Database schema created successfully!');
    console.log('   Tables: users, drivers, otps, rides');
  } catch (err) {
    console.error('🔴 Failed to initialize database:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

initDb();
