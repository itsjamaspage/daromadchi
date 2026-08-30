-- 090_users_ledger_kill_switch.sql
-- Per-user stock-ledger kill switch (stock-ledger spec §8). When true, this
-- user's groups return onHand = null and fall back to the legacy MAX pool path,
-- byte-for-byte as before the ledger — so one seller can be parked without a
-- deploy and without stopping everyone else. The global STOCK_SYNC_KILL_SWITCH
-- env var (stock-writer.ts) is unchanged and still disables ALL writes.
--
-- Spec named this 089; 089 was taken by 089_stock_sync_state_repeat_count.sql
-- between the spec and this build, so it is 090.
--
-- Additive + idempotent — safe to re-run.

ALTER TABLE users ADD COLUMN IF NOT EXISTS ledger_kill_switch boolean NOT NULL DEFAULT false;
