const assert = require('node:assert/strict');
const dbPath = require.resolve('../config/db');
const calls = [];
let respond;
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
  query: async (sql, params) => { calls.push({ sql, params }); return respond(sql, params); },
} };
const { getLeaderboard, getRecentMatches, invalidateArenaReads } = require('./arenaReads');

async function main() {
  let release;
  respond = () => new Promise(resolve => { release = resolve; });
  const first = getLeaderboard(25);
  const second = getLeaderboard(25);
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls.length, 1);
  release({ rows: [{ id: 'top', wins: 3 }] });
  assert.deepEqual(await first, [{ id: 'top', wins: 3 }]);
  await getLeaderboard(25);
  assert.equal(calls.length, 1, 'Successful summaries are reused during the five second TTL');
  invalidateArenaReads();
  respond = async () => ({ rows: [{ id: 'new-top' }] });
  assert.deepEqual(await getLeaderboard(25), [{ id: 'new-top' }]);
  assert.equal(calls.length, 2);

  invalidateArenaReads();
  respond = async () => ({ rows: [{ id: 'old', player1_id: 'trex', player2_id: 'trex',
    p1_username: 'trex', p2_username: 'trex', player2_bot_id: null,
    winner_id: null, win_reason: 'FLAG_CAPTURE', replay_json: { winner: 2 } }] });
  const [match] = await getRecentMatches(999999);
  assert.equal(calls.at(-1).params[0], 100, 'Limit is bounded before SQL execution');
  assert.equal(match.p2_username, 'Boss AI');
  assert.equal(match.winner_username, 'Boss AI');
  assert.ok(!Object.hasOwn(match, 'replay_json'));

  invalidateArenaReads();
  let attempts = 0;
  respond = async () => { attempts++; if (attempts === 1) throw new Error('database unavailable'); return { rows: [] }; };
  await assert.rejects(getRecentMatches(), /database unavailable/);
  await getRecentMatches();
  assert.equal(attempts, 2, 'Database failure must not be cached as an empty leaderboard');

  invalidateArenaReads();
  respond = () => new Promise(resolve => { release = resolve; });
  const old = getLeaderboard();
  await Promise.resolve();
  invalidateArenaReads();
  release({ rows: [{ id: 'outdated' }] });
  await old;
  respond = async () => ({ rows: [{ id: 'current' }] });
  assert.deepEqual(await getLeaderboard(), [{ id: 'current' }]);
  console.log('PASS: arena read dedupe, bounded limits, history identities, invalidation races and retry after DB errors');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
