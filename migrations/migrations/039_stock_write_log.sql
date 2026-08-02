-- 039_stock_write_log.sql
-- Phase 2 of the opt-in Stock-sync (edit) mode.
--
-- Audit trail for every stock-write attempt made by the single sanctioned
-- writer (lib/marketplace/stock-writer.ts): sent, dry-run simulated, skipped
-- (missing identifier / read-only shop), guard-blocked, kill-switched, or
-- errored. One row per attempt. Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS stock_write_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id         uuid REFERENCES products(id) ON DELETE SET NULL,
  marketplace        marketplace_type NOT NULL,
  sku                text,
  identifier         text,
  warehouse_id       text,
  endpoint           text,
  method             text,
  requested_quantity integer,
  quantity           integer,
  version            integer,
  dry_run            boolean NOT NULL DEFAULT false,
  status             text NOT NULL,
  reason             text,
  http_status        integer,
  request_body       text,
  response_body      text,
  error              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_write_log_shop_id_idx    ON stock_write_log (shop_id);
CREATE INDEX IF NOT EXISTS stock_write_log_created_at_idx ON stock_write_log (created_at);
CREATE INDEX IF NOT EXISTS stock_write_log_status_idx     ON stock_write_log (status);
