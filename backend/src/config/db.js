const { Pool } = require('pg');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://rps_admin:rps_secret_password_2026@localhost:5432/rps_arena?schema=public';

// Native PostgreSQL connection pool for raw high-speed queries & initial fallback
const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]: Unexpected error on idle client', err);
});

// Prisma Client instance with logging
let prisma;
try {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
} catch (error) {
  console.warn('[Prisma Warning]: PrismaClient initialization deferred or client not yet generated:', error.message);
  prisma = null;
}

/**
 * Health check for PostgreSQL connection
 */
async function checkDbConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() AS current_time, current_database() AS db_name');
    client.release();
    console.log(`[PostgreSQL] Connected successfully to database "${result.rows[0].db_name}" at ${result.rows[0].current_time}`);
    return true;
  } catch (err) {
    console.error('[PostgreSQL Connection Error]: Unable to connect to database:', err.message);
    return false;
  }
}

/**
 * Helper to execute raw queries with parameterized values
 */
async function query(text, params = []) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SQL Query] Executed: ${text} | Duration: ${duration}ms | Rows: ${res.rowCount}`);
  }
  return res;
}

module.exports = {
  pool,
  prisma,
  query,
  checkDbConnection,
};
