const { query } = require('../config/db');
const { normalizeMatch } = require('./matchHistory');

const TTL_MS = 5_000;
const cache = new Map();
const pending = new Map();
let generation = 0;

function invalidateArenaReads() {
  generation += 1;
  cache.clear();
  pending.clear();
}

function readCached(key, load) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.updatedAt < TTL_MS) return Promise.resolve(entry.data);
  if (pending.has(key)) return pending.get(key);
  const requestGeneration = generation;
  const request = Promise.resolve().then(load).then(data => {
    if (generation === requestGeneration) cache.set(key, { data, updatedAt: Date.now() });
    return data;
  }).finally(() => {
    if (pending.get(key) === request) pending.delete(key);
  });
  pending.set(key, request);
  return request;
}

function boundedLimit(limit, fallback) {
  const parsed = Number(limit);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, Math.trunc(parsed))) : fallback;
}

function getRecentMatches(limit = 10) {
  const count = boundedLimit(limit, 10);
  return readCached(`recent:${count}`, async () => {
    const { rows } = await query(`
      SELECT m.id, m.player1_id, m.player2_id, m.player2_bot_id,
             m.duration_ms, m.winner_id, m.win_reason, m.p1_elo_change, m.p2_elo_change,
             m.has_infinite_loop_error, m.created_at,
             CASE WHEN jsonb_typeof(m.replay_json) = 'object'
               THEN m.replay_json - ARRAY['steps', 'initialBoard', 'mapConfig']
               ELSE '{}'::jsonb END AS replay_json,
             CASE
               WHEN jsonb_typeof(m.replay_json) = 'array' THEN jsonb_array_length(m.replay_json)
               WHEN jsonb_typeof(m.replay_json->'steps') = 'array' THEN jsonb_array_length(m.replay_json->'steps')
               WHEN m.replay_json->>'totalTurns' ~ '^[0-9]+$' THEN (m.replay_json->>'totalTurns')::int
               ELSE 0
             END AS total_turns,
             u1.username AS p1_username, u1.elo_rating AS p1_elo,
             u2.username AS p2_username, u2.elo_rating AS p2_elo,
             b1.name AS p1_bot_name, b2.name AS p2_bot_name,
             uw.username AS winner_username
      FROM (SELECT * FROM "Matches" ORDER BY created_at DESC, id DESC LIMIT $1) m
      LEFT JOIN "Users" u1 ON u1.id = m.player1_id
      LEFT JOIN "Users" u2 ON u2.id = m.player2_id
      LEFT JOIN "Users" uw ON uw.id = m.winner_id
      LEFT JOIN "Bots" b1 ON b1.id = m.player1_bot_id
      LEFT JOIN "Bots" b2 ON b2.id = m.player2_bot_id
      ORDER BY m.created_at DESC, m.id DESC;
    `, [count]);
    // Only compact identity/result metadata crosses the database connection.
    return rows.map(row => {
      const { replay_json, ...match } = normalizeMatch(row);
      return match;
    });
  });
}

function getLeaderboard(limit = 50) {
  const count = boundedLimit(limit, 50);
  return readCached(`leaderboard:${count}`, async () => {
    const { rows } = await query(`
      WITH cutoff AS (
        SELECT MIN(elo_rating) AS elo FROM (
          SELECT elo_rating FROM "Users" ORDER BY elo_rating DESC LIMIT $1
        ) top_players
      )
      SELECT u.id, u.username, u.role, u.elo_rating,
             b.id AS active_bot_id, b.name AS active_bot_name,
             stats.wins, stats.losses, stats.draws
      FROM "Users" u
      CROSS JOIN cutoff
      LEFT JOIN LATERAL (
        SELECT id, name FROM "Bots"
        WHERE user_id = u.id AND is_active = true
        ORDER BY updated_at DESC, id LIMIT 1
      ) b ON true
      CROSS JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE m.winner_id = u.id)::int AS wins,
               COUNT(*) FILTER (WHERE
                 (m.winner_id IS NOT NULL AND m.winner_id != u.id)
                 OR (m.winner_id IS NULL AND m.player1_id = u.id AND m.replay_json->>'winner' = '2'
                   AND (m.player2_id IS NULL OR (m.player2_id = m.player1_id AND m.player2_bot_id IS NULL)))
               )::int AS losses,
               COUNT(*) FILTER (WHERE m.win_reason = 'DRAW'
                 OR (m.replay_json ? 'winner' AND m.replay_json->'winner' = 'null'::jsonb)
               )::int AS draws
        FROM (
          SELECT winner_id, player1_id, player2_id, player2_bot_id, replay_json, win_reason
          FROM "Matches" WHERE player1_id = u.id
          UNION ALL
          SELECT winner_id, player1_id, player2_id, player2_bot_id, replay_json, win_reason
          FROM "Matches" WHERE player2_id = u.id AND player1_id IS DISTINCT FROM u.id
        ) m
      ) stats
      WHERE u.elo_rating >= cutoff.elo
      ORDER BY u.elo_rating DESC, stats.wins DESC, u.username, u.id
      LIMIT $1;
    `, [count]);
    return rows;
  });
}

module.exports = { getLeaderboard, getRecentMatches, invalidateArenaReads };
