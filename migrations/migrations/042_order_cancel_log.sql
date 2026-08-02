-- 042_order_cancel_log.sql
-- Phase 4: audit for the oversell cancel path — a SEPARATE sanctioned write from
-- the stock endpoint, with its own method-exact allowlist. One row per attempt,
-- one-click (human) or auto. Idempotent.

CREATE TABLE IF NOT EXISTS order_cancel_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  marketplace       marketplace_type NOT NULL,
  order_id_external text,
  reason            text,
  endpoint          text,
  method            text,
  auto              boolean NOT NULL DEFAULT false,
  dry_run           boolean NOT NULL DEFAULT false,
  status            text NOT NULL,
  detail            text,
  http_status       integer,
  request_body      text,
  response_body     text,
  error             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_cancel_log_shop_id_idx    ON order_cancel_log (shop_id);
CREATE INDEX IF NOT EXISTS order_cancel_log_created_at_idx ON order_cancel_log (created_at);
CREATE INDEX IF NOT EXISTS order_cancel_log_auto_idx       ON order_cancel_log (auto);
