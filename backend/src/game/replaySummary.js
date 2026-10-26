// Compute in PostgreSQL: no step snapshots cross the DB connection for standings.
const totalTurnsSql = (alias = 'm') => `CASE
  WHEN jsonb_typeof(${alias}.replay_json)='array' THEN jsonb_array_length(${alias}.replay_json)
  WHEN jsonb_typeof(${alias}.replay_json->'steps')='array' THEN jsonb_array_length(${alias}.replay_json->'steps')
  WHEN ${alias}.replay_json->>'totalTurns' ~ '^[0-9]{1,9}$' THEN (${alias}.replay_json->>'totalTurns')::int
  ELSE 0 END`;
module.exports = {totalTurnsSql};
