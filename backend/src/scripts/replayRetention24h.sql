-- Apply the requested 24-hour policy once to existing installations too.
-- The marker preserves subsequent Admin changes across redeployments.
WITH first_run AS (
  INSERT INTO "SystemSettings" (key,value)
  VALUES ('replay_retention_24h_v1','true'::jsonb)
  ON CONFLICT (key) DO NOTHING RETURNING key
)
INSERT INTO "SystemSettings" (key,value)
SELECT 'replay_retention','{"days":1}'::jsonb FROM first_run
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;
