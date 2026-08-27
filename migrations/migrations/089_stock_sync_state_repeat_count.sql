-- 089_stock_sync_state_repeat_count.sql
-- How many times in a row we have pushed the SAME target to this (shop, sku)
-- without the listing converging on it.
--
-- WHY: the only no-op check in the write path was `target !== listedStock`, and
-- the group-level reassert bypasses it by design (any member with a diff
-- re-pushes EVERY member). stock_sync_state.last_target was already recorded and
-- never read, so nothing anywhere could say "we have already pushed this exact
-- value to this listing". PBGRY re-pushed 1 to both marketplaces every 15-20
-- minutes for hours — hundreds of marketplace calls with an unchanging value,
-- against a ~100k/day Uzum cap.
--
-- Counting repeats is what turns a silent infinite loop into a bounded one that
-- reports itself: a write whose value never sticks stops after a few attempts
-- and logs, instead of retrying for the life of the account.
--
-- Additive + idempotent.

ALTER TABLE stock_sync_state ADD COLUMN IF NOT EXISTS repeat_count integer NOT NULL DEFAULT 0;
