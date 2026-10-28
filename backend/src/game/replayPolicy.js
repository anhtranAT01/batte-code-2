// Enforce the deadline on reads, even between background cleanup batches.
const pvpDaysSql = `(SELECT CASE
  WHEN value->>'days' ~ '^[0-9]{1,4}$'
    THEN CASE WHEN (value->>'days')::int <= 3650 THEN (value->>'days')::int ELSE 0 END
  ELSE 0 END
  FROM "SystemSettings" WHERE key='pvp_replay_retention')`;

// New replays record their mode. Legacy practice sometimes used the same user twice.
function isPvPSql(alias='m') {
  return `(CASE WHEN ${alias}.replay_json->>'mode'='PRACTICE' THEN FALSE
    WHEN ${alias}.replay_json->>'mode'='PVP' THEN TRUE
    ELSE ${alias}.player2_id IS NOT NULL AND ${alias}.player1_id IS DISTINCT FROM ${alias}.player2_id END)`;
}

function retentionDaysSql(alias='m') {
  return `(CASE WHEN ${isPvPSql(alias)} THEN COALESCE(${pvpDaysSql},0) ELSE 1 END)`;
}

function replayExpiresSql(alias = 'm') {
  return `(CASE WHEN ${alias}.win_reason IS NOT NULL
    AND ${retentionDaysSql(alias)} > 0
    THEN COALESCE(${alias}.judged_at,${alias}.created_at)
      + ${retentionDaysSql(alias)} * INTERVAL '1 day' END)`;
}

function replayExpiredSql(alias = 'm') {
  const deadline = replayExpiresSql(alias);
  return `COALESCE(${alias}.replay_expired_at,CASE WHEN ${deadline} <= NOW() THEN ${deadline} END)`;
}

module.exports = {replayExpiresSql,replayExpiredSql,isPvPSql};
