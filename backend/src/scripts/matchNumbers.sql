-- Add a public, stable sequence without changing UUIDs or renumbering existing labels.
BEGIN;
LOCK TABLE "Matches" IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE "Matches" ADD COLUMN IF NOT EXISTS match_number BIGINT;
CREATE SEQUENCE IF NOT EXISTS match_number_seq;
ALTER SEQUENCE match_number_seq OWNED BY "Matches".match_number;
WITH missing AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at,id)
    + COALESCE((SELECT MAX(match_number) FROM "Matches"),0) AS number
  FROM "Matches" WHERE match_number IS NULL
)
UPDATE "Matches" m SET match_number=missing.number FROM missing WHERE m.id=missing.id;
SELECT setval('match_number_seq',GREATEST(
  COALESCE((SELECT MAX(match_number) FROM "Matches"),0),
  (SELECT last_value FROM match_number_seq),1),
  (SELECT is_called FROM match_number_seq) OR EXISTS (SELECT 1 FROM "Matches"));
ALTER TABLE "Matches" ALTER COLUMN match_number SET DEFAULT nextval('match_number_seq');
ALTER TABLE "Matches" ALTER COLUMN match_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_number ON "Matches" (match_number);
COMMIT;
