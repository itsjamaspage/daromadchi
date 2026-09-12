-- Product write audit log for Yandex product creation via API
-- Approved by owner (jkhakimjonov8@gmail.com) as the third sanctioned marketplace write.

CREATE TABLE IF NOT EXISTS product_write_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marketplace    marketplace_type NOT NULL,
  offer_id       TEXT,
  offer_name     TEXT,
  offer_count    INTEGER,
  endpoint       TEXT,
  method         TEXT,
  status         TEXT NOT NULL,
  reason         TEXT,
  http_status    INTEGER,
  request_body   TEXT,
  response_body  TEXT,
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_write_log_shop_id_idx ON product_write_log (shop_id);
CREATE INDEX IF NOT EXISTS product_write_log_user_id_idx ON product_write_log (user_id);
CREATE INDEX IF NOT EXISTS product_write_log_created_at_idx ON product_write_log (created_at);
CREATE INDEX IF NOT EXISTS product_write_log_status_idx ON product_write_log (status);
