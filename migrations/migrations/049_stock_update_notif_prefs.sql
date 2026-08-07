-- 049_stock_update_notif_prefs.sql
-- Cross-store stock-sync notifications: two INDEPENDENT per-user channel
-- toggles for the "stock was updated on the other marketplace" event.
-- (a) in-app pop-up, (b) Telegram message. Both default ON. Idempotent.
--
-- These gate ONLY the cross-store stock-UPDATE notification (fires on an actual
-- write event, never on every sale), and are independent of the existing
-- notif_* Telegram-digest toggles.

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notif_stock_update_inapp    boolean NOT NULL DEFAULT true;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notif_stock_update_telegram boolean NOT NULL DEFAULT true;
