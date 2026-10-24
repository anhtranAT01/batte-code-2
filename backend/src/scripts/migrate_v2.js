const { query } = require('../config/db');

async function migrateV2() {
  try {
    await query(`
      ALTER TABLE "Bots" ADD COLUMN IF NOT EXISTS "tactic" VARCHAR(50) DEFAULT 'FLAG_RUSHER';
      ALTER TABLE "Tournaments" ADD COLUMN IF NOT EXISTS "mode" VARCHAR(30) DEFAULT 'ALL_IN';
    `);
    console.log('✅ Migration V2 executed successfully: Added tactic to Bots and mode to Tournaments');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration V2 failed:', err);
    process.exit(1);
  }
}

migrateV2();
