-- 050_stock_notify_state.sql
-- Notification DEDUP for cross-store stock-sync updates. One row per
-- (user, sku, marketplace) holding the LAST outcome we notified about, so a
-- notification fires only when THIS cycle's outcome (status + target + reason)
-- DIFFERS from the stored one. Suppresses the every-5-min repeat of a persistent
-- write failure while the underlying state is unchanged. Suppresses only
-- NOTIFICATIONS — stock_write_log still records every attempt. Idempotent.

CREATE TABLE IF NOT EXISTS stock_notify_state (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sku          text NOT NULL,
  marketplace  marketplace_type NOT NULL,
  last_status  text,
  last_target  integer,
  last_reason  text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_notify_state_user_sku_mp_unique
  ON stock_notify_state (user_id, sku, marketplace);
CREATE INDEX IF NOT EXISTS stock_notify_state_user_id_idx
  ON stock_notify_state (user_id);
