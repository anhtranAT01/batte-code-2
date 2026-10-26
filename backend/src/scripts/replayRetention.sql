ALTER TABLE "Matches" ADD COLUMN IF NOT EXISTS replay_expired_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS matches_replay_cleanup
  ON "Matches" ((COALESCE(judged_at,created_at)),id)
  WHERE replay_expired_at IS NULL AND win_reason IS NOT NULL;
INSERT INTO "SystemSettings" (key,value) VALUES ('replay_retention','{"days":0}')
  ON CONFLICT (key) DO NOTHING;
