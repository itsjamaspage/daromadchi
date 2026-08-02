-- 040_stock_sync_state.sql
-- Phase 3 of the opt-in Stock-sync (edit) mode.
--
-- Monotonic freshness version per (shop, sku-group) plus the last decision, so
-- every stock write is stamped with a version at the moment it's computed and a
-- stale/retried write can be refused (freshness guard enforced in Phase 4).
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS stock_sync_state (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id     uuid REFERENCES products(id) ON DELETE SET NULL,
  sku            text NOT NULL,
  version        integer NOT NULL DEFAULT 0,
  last_available integer,
  last_target    integer,
  last_pushed_at timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_sync_state_shop_sku_unique ON stock_sync_state (shop_id, sku);
CREATE INDEX IF NOT EXISTS stock_sync_state_shop_id_idx ON stock_sync_state (shop_id);
