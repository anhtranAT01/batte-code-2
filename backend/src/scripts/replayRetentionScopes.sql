-- PvP has its own Admin policy; machine matches always expire after 24 hours.
-- Keep this separate from the former global setting so redeploys cannot reset it.
INSERT INTO "SystemSettings"(key,value) VALUES ('pvp_replay_retention','{"days":0}')
  ON CONFLICT(key) DO NOTHING;
-- Stop older instances from applying the former global policy during a rolling deploy.
INSERT INTO "SystemSettings"(key,value) VALUES ('replay_retention','{"days":0}')
  ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value;
