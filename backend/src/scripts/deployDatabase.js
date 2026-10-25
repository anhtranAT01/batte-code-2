const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function deployDatabase() {
  const initPath = path.resolve(__dirname, '../../init.sql');
  const source = fs.readFileSync(initPath, 'utf8');
  const schemaAndMaps = source.split('-- Seed default System Administrator account')[0];

  await pool.query(schemaAndMaps);
  await pool.query(`
    ALTER TABLE "Bots" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "Bots" ADD COLUMN IF NOT EXISTS "source_code" TEXT;
    ALTER TABLE "Bots" ADD COLUMN IF NOT EXISTS "tactic" VARCHAR(50) DEFAULT 'FLAG_RUSHER';
    ALTER TABLE "Tournaments" ADD COLUMN IF NOT EXISTS "scheduled_start_at" TIMESTAMPTZ;
    ALTER TABLE "Tournaments" ADD COLUMN IF NOT EXISTS "brackets_json" JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE "Tournaments" ADD COLUMN IF NOT EXISTS "mode" VARCHAR(30) DEFAULT 'ALL_IN';
  `);

  console.log('[Deploy] Supabase database schema is ready.');
}

deployDatabase()
  .catch((error) => {
    console.error('[Deploy] Database setup failed:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
