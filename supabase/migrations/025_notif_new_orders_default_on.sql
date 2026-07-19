-- Real-time "new order to fulfill" Telegram alerts used to be off by default
-- (and the old implementation spammed re-synced orders, so nobody enabled it).
-- The alert now fires only for genuinely NEW pending/confirmed orders, so it
-- defaults to ON; users can still disable it in Telegram prefs.
-- Idempotent: safe to run repeatedly.

ALTER TABLE user_settings ALTER COLUMN notif_new_orders SET DEFAULT true;
UPDATE user_settings SET notif_new_orders = true WHERE notif_new_orders = false;
