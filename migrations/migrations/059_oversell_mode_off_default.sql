-- 059_oversell_mode_off_default.sql
-- Make 'off' (mirror-always) the oversell mode for ALL FBS stock-sync groups:
-- the last-unit lock is removed, so every writable channel mirrors the true
-- free-to-sell number (MAX(stock) − SUM(pending), floor 0). The owner accepts
-- the last-unit oversell tradeoff.
--
-- Additive/idempotent: migrate existing lock_last_unit rows to 'off' and flip the
-- column default. 'partition' rows (if any) are left as-is. Re-running is a no-op.
UPDATE shops SET oversell_mode = 'off' WHERE oversell_mode = 'lock_last_unit';
ALTER TABLE shops ALTER COLUMN oversell_mode SET DEFAULT 'off';
