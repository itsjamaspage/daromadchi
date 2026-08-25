-- 085_notif_stock_manual.sql
-- Per-user toggle for the MANUAL stock reminder: the Telegram/in-app message
-- that tells a seller which number to set by hand on a read-only shop.
--
-- Separate from notif_stock_update_* (049) on purpose. Those gate the digest
-- that fires when Daromadchi WROTE stock to a marketplace; this one gates a
-- message sent precisely BECAUSE it cannot write. A seller who turns the
-- write-digest off has said "stop telling me about writes", not "stop telling
-- me what to fix by hand".
--
-- Default ON: a read-only seller gets no stock alert at all today, so the
-- feature only exists if it is on by default. Idempotent.

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notif_stock_manual boolean NOT NULL DEFAULT true;
