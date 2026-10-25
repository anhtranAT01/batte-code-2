ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS student_id VARCHAR(50);
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS team_name VARCHAR(100);
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS email VARCHAR(254);
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Matches" ADD COLUMN IF NOT EXISTS judged_at TIMESTAMPTZ;
UPDATE "Matches" SET judged_at=created_at WHERE judged_at IS NULL AND duration_ms>0 AND replay_json IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON "Users" (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_student_id_unique ON "Users" (student_id) WHERE student_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS "Submissions" (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  source TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  bot_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','accepted','rejected')),
  attempts INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS submissions_pending ON "Submissions" (retry_at) WHERE status IN ('pending','processing');
CREATE INDEX IF NOT EXISTS submissions_owner ON "Submissions" (user_id,received_at DESC);

CREATE TABLE IF NOT EXISTS "Questions" (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  category VARCHAR(30) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  answered_by UUID REFERENCES "Users"(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS questions_owner ON "Questions" (user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS "SystemSettings" (key TEXT PRIMARY KEY,value JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS "PasswordResets" (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
