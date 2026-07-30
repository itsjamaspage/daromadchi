-- 036_uzum_settlements.sql
-- Stores per-order-item settlement data from Uzum's /v1/finance/orders endpoint.
-- One row per order item — Uzum's SellerOrderItemDto.id is stable and unique per
-- item, so it's our natural upsert key. Populated by lib/uzum/settlements-sync.ts.
-- Aggregated per shop × month in lib/db/payouts.ts so the Payouts UI shows
-- Uzum's REAL commission / delivery / profit instead of Unit Economics estimates.

CREATE TABLE IF NOT EXISTS uzum_settlement_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id               UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  -- SellerOrderItemDto.id — per-item, unique across a shop's order items.
  uzum_order_item_id    BIGINT NOT NULL,
  uzum_order_id         BIGINT NOT NULL,
  uzum_shop_id          BIGINT,
  product_id            BIGINT,
  product_title         TEXT,
  sku_title             TEXT,
  -- TO_WITHDRAW | PROCESSING | CANCELED | PARTIALLY_CANCELLED
  status                TEXT NOT NULL,
  -- Transaction date the item hit its current status.
  transaction_at        TIMESTAMPTZ,
  date_issued_at        TIMESTAMPTZ,
  -- ACTUAL numbers from Uzum — not estimates. Zero-safe defaults so we can
  -- always aggregate without null checks.
  seller_price          NUMERIC(14,2) NOT NULL DEFAULT 0,
  commission            NUMERIC(14,2) NOT NULL DEFAULT 0,
  seller_profit         NUMERIC(14,2),
  withdrawn_profit      NUMERIC(14,2),
  purchase_price        NUMERIC(14,2),
  logistic_delivery_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount                INTEGER,
  amount_returns        INTEGER,
  cancelled             INTEGER,
  return_cause          TEXT,
  comment               TEXT,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, uzum_order_item_id)
);

CREATE INDEX IF NOT EXISTS uzum_settlement_shop_order_idx
  ON uzum_settlement_orders (shop_id, uzum_order_id);
CREATE INDEX IF NOT EXISTS uzum_settlement_transaction_at_idx
  ON uzum_settlement_orders (transaction_at);
