// Enforce the deadline on reads, even between background cleanup batches.
const retentionDaysSql = `(SELECT CASE
  WHEN value->>'days' ~ '^[0-9]{1,4}$'
    THEN CASE WHEN (value->>'days')::int <= 3650 THEN (value->>'days')::int ELSE 1 END
  ELSE 1 END
  FROM "SystemSettings" WHERE key='replay_retention')`;

function replayExpiresSql(alias = 'm') {
  return `(CASE WHEN ${alias}.win_reason IS NOT NULL
    AND COALESCE(${retentionDaysSql},1) > 0
    THEN COALESCE(${alias}.judged_at,${alias}.created_at)
      + COALESCE(${retentionDaysSql},1) * INTERVAL '1 day' END)`;
}

function replayExpiredSql(alias = 'm') {
  const deadline = replayExpiresSql(alias);
  return `COALESCE(${alias}.replay_expired_at,CASE WHEN ${deadline} <= NOW() THEN ${deadline} END)`;
}

module.exports = {replayExpiresSql,replayExpiredSql};
