const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');

const adminId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const teacherId = '33333333-3333-4333-8333-333333333333';
const missingId = '44444444-4444-4444-8444-444444444444';
const users = new Map([
  [adminId, { id: adminId, username: 'admin', role: 'ADMIN' }],
  [targetId, { id: targetId, username: 'student', role: 'STUDENT' }],
  [teacherId, { id: teacherId, username: 'teacher', role: 'TEACHER' }],
]);
let forcedAdminCount;
let loseRoleInTransaction = false;
let queueUnavailable = false;
let writes = 0;
let invalidations = 0;
const statements = [];
const safeUser = user => user ? { id: user.id, username: user.username, role: user.role } : undefined;
const query = async (sql, args = []) => {
  statements.push(sql);
  if (sql.includes('AS users') && sql.includes('AS tournaments')) {
    return { rows: [{ users: users.size, bots: 4, matches: 10, tournaments: 2 }] };
  }
  if (sql.includes('COUNT(*)::INT AS count')) {
    return { rows: [{ count: forcedAdminCount ?? [...users.values()].filter(user => user.role === 'ADMIN').length }] };
  }
  if (sql.startsWith('SELECT role') || sql.startsWith('SELECT id, role')) {
    const user = users.get(args[0]);
    return { rows: user ? [safeUser(user)] : [] };
  }
  if (sql.startsWith('UPDATE "Users"')) {
    const user = users.get(args[1]);
    if (!user) return { rows: [] };
    if (sql.includes('SET username')) {
      if ([...users.values()].some(item => item.id !== user.id && item.username === args[0])) {
        throw Object.assign(new Error('Duplicate username'), { code: '23505' });
      }
      user.username = args[0];
    } else if (sql.includes('SET password_hash')) user.password_hash = args[0];
    else if (sql.includes('SET role')) user.role = args[0];
    else if (sql.includes('SET elo_rating')) user.elo_rating = args[0];
    writes++;
    return { rows: [safeUser(user)] };
  }
  return { rows: [] };
};
const client = {
  async query(sql, args) {
    if (loseRoleInTransaction && sql.startsWith('SELECT role')) return { rows: [{ role: 'STUDENT' }] };
    return query(sql, args);
  },
  release() {},
};
function stub(modulePath, exports) {
  require.cache[require.resolve(modulePath)] = { id: require.resolve(modulePath), filename: require.resolve(modulePath), loaded: true, exports };
}
stub('../config/db', { query, pool: { connect: async () => client } });
stub('../config/redis', { matchQueue: { getJobCounts: () => queueUnavailable ? new Promise(() => {}) : Promise.resolve({ waiting: 1, active: 2 }) } });
stub('../tournament/tournament.service', {});
stub('../game/gameService', {});
stub('../game/arenaReads', { invalidateArenaReads: () => { invalidations++; } });

const app = express();
app.use(express.json());
app.use('/api/admin', require('./admin.routes'));
app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ success: false, message: error.message }));

async function main() {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const token = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET || 'super_secret_jwt_key_tactical_rps_2026_x892k');
    const request = async (path, body, id = adminId, role = 'ADMIN') => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/users/${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(id ? { Authorization: `Bearer ${token(id, role)}` } : {}) },
        body: JSON.stringify(body),
      });
      return { status: response.status, ...await response.json() };
    };
    for (const endpoint of ['account', 'role', 'password']) {
      const body = { username: 'new_name', role: 'ADMIN', password: 'new_password_123' };
      assert.equal((await request(`${targetId}/${endpoint}`, body, null)).status, 401);
      assert.equal((await request(`${targetId}/${endpoint}`, body, teacherId, 'TEACHER')).status, 403);
      assert.equal((await request(`${targetId}/${endpoint}`, body, teacherId, 'ADMIN')).status, 403, 'Stale ADMIN JWT must not grant account access');
    }
    assert.equal(writes, 0);
    assert.equal(invalidations, 0);
    console.log('PASS: missing login, teachers, and stale admin tokens cannot manage names, roles, or passwords');

    assert.equal((await request(`${targetId}/account`, { username: ' invalid space ' })).status, 400);
    assert.equal((await request(`invalid/account`, { username: 'valid_name' })).status, 400);
    assert.equal((await request(`${targetId}/account`, { username: 'admin' })).status, 409);
    assert.equal((await request(`${missingId}/account`, { username: 'valid_name' })).status, 404);
    const renamed = await request(`${targetId}/account`, { username: ' renamed_student ' });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.data.username, 'renamed_student');
    assert.equal(invalidations, 1, 'A successful rename must invalidate leaderboard/history metadata');
    console.log('PASS: account names validate, trim, reject duplicates, and report missing users');

    const beforeInvalidPassword = writes;
    assert.equal((await request(`${targetId}/password`, { password: 'short' })).status, 400);
    assert.equal((await request(`${targetId}/password`, { password: 'a'.repeat(73) })).status, 400);
    assert.equal((await request(`${targetId}/password`, { password: '🙂'.repeat(20) })).status, 400, 'bcrypt byte limit must account for UTF-8');
    assert.equal(writes, beforeInvalidPassword);
    const password = 'new_password_123';
    const reset = await request(`${targetId}/password`, { password });
    assert.equal(reset.status, 200);
    const stored = users.get(targetId).password_hash;
    assert.notEqual(stored, password);
    assert.equal(await bcrypt.compare(password, stored), true);
    assert.equal(await bcrypt.compare('old_password', stored), false);
    assert.ok(!JSON.stringify(reset).includes(password));
    assert.ok(!JSON.stringify(reset).includes(stored));
    assert.equal(invalidations, 1, 'Password resets do not change public arena metadata');
    console.log('PASS: password reset stores a bcrypt hash, rejects invalid passwords, and never returns credentials');

    assert.equal((await request(`${targetId}/role`, { role: 'OWNER' })).status, 400);
    assert.equal((await request(`${adminId}/role`, { role: 'STUDENT' })).status, 400);
    assert.equal((await request(`${targetId}/role`, { role: 'ADMIN' })).status, 200);
    forcedAdminCount = 1;
    assert.equal((await request(`${targetId}/role`, { role: 'TEACHER' })).status, 400);
    forcedAdminCount = undefined;
    assert.equal((await request(`${targetId}/role`, { role: 'TEACHER' })).status, 200);
    assert.equal(users.get(targetId).role, 'TEACHER');
    assert.ok(statements.includes('SELECT pg_advisory_xact_lock(87292103)'));
    loseRoleInTransaction = true;
    assert.equal((await request(`${targetId}/role`, { role: 'ADMIN' })).status, 403);
    assert.equal(users.get(targetId).role, 'TEACHER');
    assert.equal(statements.at(-1), 'ROLLBACK');
    assert.equal(invalidations, 3, 'Only successful role changes invalidate public metadata');
    console.log('PASS: role changes protect own/last admin and recheck authority inside the serialized transaction');

    assert.equal((await request(`${missingId}/elo`, { elo: 1600 })).status, 404);
    assert.equal(invalidations, 3);
    assert.equal((await request(`${targetId}/elo`, { elo: 1600 })).status, 200);
    assert.equal(invalidations, 4, 'Successful Elo changes invalidate cached rankings immediately');
    console.log('PASS: successful name, role and Elo updates invalidate arena caches; rejected changes do not');

    queueUnavailable = true;
    const started = Date.now();
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${token(adminId, 'ADMIN')}` },
    });
    const stats = await response.json();
    assert.equal(response.status, 200);
    assert.equal(stats.data.totalUsers, users.size);
    assert.equal(stats.data.queueAvailable, false);
    assert.ok(Date.now() - started < 1600, 'Unavailable Redis must not hang the stats view');
    console.log('PASS: system metrics use one DB request and return within a bound when Redis cannot connect');
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
