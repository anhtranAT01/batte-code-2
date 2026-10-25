const { query, pool } = require('../config/db');
const bcrypt = require('bcryptjs');

async function test() {
  const res = await query('SELECT username, password_hash, role FROM "Users" WHERE username = $1', ['admin']);
  if (!res.rows[0]) {
    console.log('No admin user found!');
  } else {
    const user = res.rows[0];
    console.log('Admin found:', user.username, 'Role:', user.role);
    console.log('Hash:', user.password_hash);
    console.log('Match admin123:', bcrypt.compareSync('admin123', user.password_hash));
  }
  await pool.end();
}

test();
