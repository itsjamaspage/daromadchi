-- 079: account lifecycle — when a seller was last here, and whether we froze them.
--
--   last_active_at  set on every sign-in. NULL means "never signed in since this
--                   column existed", which the sweep treats as UNKNOWN, not as
--                   inactive: a NULL must never be read as a year of silence.
--   frozen_at       when the account was frozen. NULL = not frozen. Freezing
--                   destroys nothing; it gates the dashboard behind a one-click
--                   reactivate.
--
-- Backfilled from created_at rather than left NULL, deliberately: every existing
-- account has been signing in without this column, and treating them as UNKNOWN
-- forever would mean the lifecycle never applies to anyone who predates it. The
-- account's creation date is the earliest defensible "we know they were here",
-- and it starts the clock generously late rather than early.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, and the backfill only touches rows that
-- are still NULL, so re-running never resets a real sign-in back to signup date.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS frozen_at      timestamptz;

UPDATE users SET last_active_at = created_at WHERE last_active_at IS NULL;

-- The sweep asks "who has not been seen since <date>", which is this index.
CREATE INDEX IF NOT EXISTS users_last_active_idx ON users (last_active_at);
