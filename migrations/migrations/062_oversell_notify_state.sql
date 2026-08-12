-- 062_oversell_notify_state.sql
-- Dedup for the OVERSELL alert. An unresolved oversell (a reserving order that
-- exceeds physical stock) otherwise re-fires the same «⚠️ Oversell» Telegram
-- message on every 5-min reconcile cycle — the seller receives dozens of
-- identical alerts for ONE situation. This table records the last oversell we
-- alerted about per (user, match_key); the alert now fires only on a distinct
-- oversell (a new later order, or a deeper oversold count).
--
-- Additive + idempotent (CREATE TABLE / INDEX IF NOT EXISTS) — safe to re-run.
CREATE TABLE IF NOT EXISTS oversell_notify_state (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_key        text NOT NULL,
  last_order_ext   text,
  last_oversold_by integer,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS oversell_notify_state_user_key_unique
  ON oversell_notify_state (user_id, match_key);
CREATE INDEX IF NOT EXISTS oversell_notify_state_user_id_idx
  ON oversell_notify_state (user_id);
