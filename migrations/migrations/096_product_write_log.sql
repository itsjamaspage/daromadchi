-- Audit trail for Yandex product creation/update attempts.
-- Mirrors the stock_write_log pattern. One row per push attempt.
CREATE TABLE IF NOT EXISTS product_write_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marketplace   marketplace_type NOT NULL,
  offer_id      text,
  offer_name    text,
  offer_count   integer,
  endpoint      text,
  method        text,
  status        text NOT NULL,
  reason        text,
  http_status   integer,
  request_body  text,
  response_body text,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_write_log_shop_id_idx ON product_write_log(shop_id);
CREATE INDEX IF NOT EXISTS product_write_log_user_id_idx ON product_write_log(user_id);
CREATE INDEX IF NOT EXISTS product_write_log_created_at_idx ON product_write_log(created_at);
CREATE INDEX IF NOT EXISTS product_write_log_status_idx ON product_write_log(status);
