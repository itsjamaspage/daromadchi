-- 037_shops_throttled_until.sql
-- Persisted rate-limit cooldown for marketplace sync. The in-memory
-- version in lib/wildberries/sync.ts didn't survive PM2 restarts —
-- every deploy wiped it, letting the next cron hit WB fresh and get
-- another 429, which kept the seller effectively throttled forever.
-- Store the "resume-after" timestamp on the shop row so it persists
-- across deploys and is queryable for a "Reset throttle" UI action.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS throttled_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS shops_throttled_until_idx
  ON shops (throttled_until)
  WHERE throttled_until IS NOT NULL;
