-- 061_stock_notify_order_seen.sql
-- Decouples the stock digest from reconcile writes: notifications must fire on a
-- genuinely NEW reserving order (a real sale), not on every idempotent stock
-- correction. One row per (user, match_key) records the set of reserving order
-- ids already accounted for on that SKU group; a run whose reserving-order set
-- contains an id NOT in this set is a new sale and may notify. A pure reconcile
-- write (no new order) stays SILENT.
--
-- Additive + idempotent (CREATE TABLE / INDEX IF NOT EXISTS) — safe to re-run.
CREATE TABLE IF NOT EXISTS stock_notify_order_seen (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_key      text NOT NULL,
  seen_order_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_notify_order_seen_user_key_unique
  ON stock_notify_order_seen (user_id, match_key);
CREATE INDEX IF NOT EXISTS stock_notify_order_seen_user_id_idx
  ON stock_notify_order_seen (user_id);
