const { z } = require('zod');
const { query, pool } = require('../config/db');
const { normalizeMatch } = require('../game/matchHistory');
const { replayExpiresSql,replayExpiredSql } = require('../game/replayPolicy');

const fail = (message,statusCode = 400) => Object.assign(new Error(message),{statusCode});
function validateId(id) {
  if (!z.string().uuid().safeParse(id).success) throw fail('Mã định danh không hợp lệ.');
  return id.toLowerCase();
}

async function listMatches({limit = 25,offset = 0} = {}) {
  limit = Math.max(1,Math.min(100,Number.parseInt(limit,10) || 25));
  offset = Math.max(0,Number.parseInt(offset,10) || 0);
  const result = await query(`
    SELECT m.id,m.match_number,m.player1_id,m.player2_id,m.player2_bot_id,m.winner_id,
      m.win_reason,m.duration_ms,m.created_at,m.tournament_id,
      ${replayExpiredSql()} AS replay_expired_at,${replayExpiresSql()} AS replay_expires_at,
      u1.username AS p1_username,u2.username AS p2_username,uw.username AS winner_username,
      CASE WHEN jsonb_typeof(m.replay_json)='object'
        THEN m.replay_json - ARRAY['steps','initialBoard','mapConfig']
        ELSE '{}'::jsonb END AS replay_json
    FROM (SELECT * FROM "Matches" ORDER BY created_at DESC,id DESC LIMIT $1 OFFSET $2) m
    LEFT JOIN "Users" u1 ON u1.id=m.player1_id
    LEFT JOIN "Users" u2 ON u2.id=m.player2_id
    LEFT JOIN "Users" uw ON uw.id=m.winner_id
    ORDER BY m.created_at DESC,m.id DESC`,[limit+1,offset]);
  return {matches:result.rows.slice(0,limit).map(row => {
    const {replay_json,...match} = normalizeMatch(row);
    return match;
  }),pagination:{limit,offset,hasMore:result.rows.length > limit}};
}

async function deleteMatch(id) {
  id = validateId(id);
  const result = await query('DELETE FROM "Matches" WHERE id = $1 RETURNING id',[id]);
  if (!result.rows[0]) throw fail('Không tìm thấy trận đấu.',404);
  return result.rows[0];
}

async function deleteUser(actorId,id) {
  id = validateId(id);
  if (actorId.toLowerCase() === id) throw fail('Bạn không thể xóa tài khoản Admin đang đăng nhập.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Share the role-change lock so concurrent admin removal cannot cause lockout.
    await client.query('SELECT pg_advisory_xact_lock(87292103)');
    const actor = await client.query('SELECT role FROM "Users" WHERE id = $1',[actorId]);
    if (actor.rows[0]?.role !== 'ADMIN') throw fail('Chỉ Admin được xóa tài khoản.',403);
    const target = await client.query('SELECT id,username,role FROM "Users" WHERE id = $1 FOR UPDATE',[id]);
    if (!target.rows[0]) throw fail('Không tìm thấy người dùng.',404);
    if (target.rows[0].role === 'ADMIN') {
      const count = await client.query('SELECT COUNT(*)::INT AS count FROM "Users" WHERE role = \'ADMIN\'');
      if (count.rows[0].count <= 1) throw fail('Không thể xóa Admin cuối cùng.');
    }
    // Registrations live in JSON rather than a cascading foreign-key table.
    await client.query(`UPDATE "Tournaments" t SET settings_json = jsonb_set(t.settings_json,'{participants}',
      COALESCE((SELECT jsonb_agg(p) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t.settings_json->'participants')='array'
        THEN t.settings_json->'participants' ELSE '[]'::jsonb END) p
        WHERE p->>'userId' IS DISTINCT FROM $1 AND p->>'id' IS DISTINCT FROM $1),'[]'::jsonb)),
      updated_at=NOW()
      WHERE jsonb_typeof(t.settings_json->'participants')='array'
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t.settings_json->'participants')='array'
          THEN t.settings_json->'participants' ELSE '[]'::jsonb END) p
          WHERE p->>'userId'=$1 OR p->>'id'=$1)`,[id]);
    // Foreign keys cascade Bots and Matches; other users' Elo is retained.
    await client.query('DELETE FROM "Users" WHERE id = $1',[id]);
    await client.query('COMMIT');
    return target.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

module.exports = { listMatches,deleteMatch,deleteUser };
