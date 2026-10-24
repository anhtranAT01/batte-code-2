const { query, pool } = require('../config/db');

async function migrate() {
  try {
    await query(`
      ALTER TABLE "Bots" ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "Tournaments" ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE "Tournaments" ADD COLUMN IF NOT EXISTS brackets_json JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);
    console.log('[Migration] Successfully added is_active, scheduled_start_at, brackets_json columns!');
  } catch (err) {
    console.error('[Migration Error]:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
