-- Return invoices from Uzum warehouses (Sergeli etc.). Tracks items the seller
-- needs to pick up, their pickup window, and storage fees.
-- Additive + idempotent.

CREATE TABLE IF NOT EXISTS return_invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  return_id_external  INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'CREATED',
  warehouse_name      TEXT,
  warehouse_address   TEXT,
  pickup_start        TIMESTAMPTZ,
  pickup_end          TIMESTAMPTZ,
  pickup_status       TEXT,
  storage_daily_rate  NUMERIC(14, 2),
  storage_start       TIMESTAMPTZ,
  storage_end         TIMESTAMPTZ,
  type                TEXT,
  date_created        TIMESTAMPTZ,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS return_invoices_shop_ext_unique
  ON return_invoices (shop_id, return_id_external);

CREATE INDEX IF NOT EXISTS return_invoices_shop_status_idx
  ON return_invoices (shop_id, status);

CREATE TABLE IF NOT EXISTS return_invoice_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_invoice_id   UUID NOT NULL REFERENCES return_invoices(id) ON DELETE CASCADE,
  sku_id_external     INTEGER NOT NULL,
  sku_title           TEXT,
  product_title       TEXT,
  amount              INTEGER NOT NULL DEFAULT 0,
  packed_amount       INTEGER NOT NULL DEFAULT 0,
  purchase_price      NUMERIC(14, 2)
);

CREATE INDEX IF NOT EXISTS return_invoice_items_invoice_idx
  ON return_invoice_items (return_invoice_id);
