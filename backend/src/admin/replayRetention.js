const {query,pool} = require('../config/db');
const {totalTurnsSql} = require('../game/replaySummary');
const KEY = 'replay_retention';
const INTERVAL_MS = 5 * 60_000;
const BATCH_SIZE = 100;

async function getSettings() {
  const {rows} = await query('SELECT key,value FROM "SystemSettings" WHERE key IN ($1,$2)',[KEY,'replay_cleanup_status']);
  return {days:rows.find(row=>row.key===KEY)?.value?.days ?? 1,
    lastCleanup:rows.find(row=>row.key==='replay_cleanup_status')?.value ?? null,checkIntervalMinutes:5};
}
async function saveSettings(days) {
  if (!Number.isInteger(days) || days < 0 || days > 3650) {
    throw Object.assign(new Error('Số ngày lưu phải là số nguyên từ 0 đến 3650 (0 = không tự xóa).'),{statusCode:400});
  }
  await query(`INSERT INTO "SystemSettings"(key,value) VALUES($1,$2::jsonb)
    ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`,[KEY,JSON.stringify({days})]);
  require('../game/arenaReads').invalidateArenaReads();
  return getSettings();
}

// One short transaction per batch. Separate app instances skip locked rows.
// Lock the setting while processing so disabling the policy waits for this batch only.
async function cleanupBatch() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    const setting = await client.query('SELECT value FROM "SystemSettings" WHERE key=$1 FOR SHARE',[KEY]);
    const days = setting.rows[0]?.value?.days;
    if (!Number.isInteger(days) || days <= 0 || days > 3650) { await client.query('COMMIT'); return {removed:0,enabled:false}; }
    const result = await client.query(`WITH expired AS (
      SELECT m.id FROM "Matches" m
      WHERE m.replay_expired_at IS NULL AND m.win_reason IS NOT NULL
        AND COALESCE(m.judged_at,m.created_at) <= NOW() - ($1::int * INTERVAL '1 day')
      ORDER BY COALESCE(m.judged_at,m.created_at),m.id
      LIMIT $2 FOR UPDATE OF m SKIP LOCKED
    ) UPDATE "Matches" m SET
      replay_json=(CASE WHEN jsonb_typeof(m.replay_json)='object'
        THEN m.replay_json - ARRAY['steps','initialBoard','mapConfig'] ELSE '{}'::jsonb END)
        || jsonb_build_object('totalTurns',${totalTurnsSql('m')}),
      replay_expired_at=NOW()
      FROM expired WHERE m.id=expired.id RETURNING m.id`,[days,BATCH_SIZE]);
    const removed = result.rowCount;
    await client.query(`INSERT INTO "SystemSettings"(key,value) VALUES('replay_cleanup_status',$1::jsonb)
      ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`,[JSON.stringify({checkedAt:new Date().toISOString(),removed,days})]);
    await client.query('COMMIT');
    if (removed) require('../game/arenaReads').invalidateArenaReads();
    return {removed,enabled:true};
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

let timer, stopped=true, running=false;
function schedule(delay) {
  if(stopped)return;
  timer=setTimeout(async()=>{
    running=true;let delayNext=INTERVAL_MS;
    try {const result=await cleanupBatch();if(result.removed===BATCH_SIZE)delayNext=1000;}
    catch(error){console.warn('[ReplayCleanup]',error.code || error.message);}
    finally {running=false;schedule(delayNext);}
  },delay);timer.unref?.();
}
function start(){if(!stopped)return;stopped=false;if(!running)schedule(60_000);}
function stop(){stopped=true;clearTimeout(timer);}
module.exports={getSettings,saveSettings,cleanupBatch,start,stop,BATCH_SIZE};
