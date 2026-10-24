const { query } = require('../config/db');

async function check() {
  const res = await query('SELECT id, username, role, elo_rating FROM "Users"');
  console.log('ALL USERS IN DB:', res.rows);
  const tourneys = await query('SELECT id, name, status, scheduled_start_at FROM "Tournaments"');
  console.log('ALL TOURNAMENTS IN DB:', tourneys.rows);
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
