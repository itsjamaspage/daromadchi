-- 085_notif_stock_manual.sql
-- Read-only "update your stock manually" reminder toggle.
--
-- For sellers running READ-ONLY marketplace keys (Daromadchi never writes stock
-- for them): when a linked cross-marketplace SKU is out of sync, a Telegram +
-- in-app reminder tells the seller the exact quantity to set by hand. One
-- dedicated per-user toggle governing that reminder (both channels), default ON,
-- independent of the edit-mode notif_stock_update_* toggles. Idempotent.

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notif_stock_manual boolean NOT NULL DEFAULT true;
