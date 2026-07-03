-- Composite indexes for the most common multi-column query patterns.
-- Uses CONCURRENTLY to avoid table locks on production.
-- NOTE: CONCURRENTLY cannot run inside a transaction. If your migration
-- runner wraps files in BEGIN/COMMIT, run these statements manually in
-- the Supabase SQL Editor instead.

-- KPI, revenue, PnL, and seasonality queries all filter on
-- shop_id + status (exclude 'cancelled') + ordered_at range.
-- The existing idx_orders_shop_ordered covers (shop_id, ordered_at)
-- but adding status lets Postgres skip cancelled rows in the index scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_shop_status_ordered
  ON orders(shop_id, status, ordered_at DESC);

-- Alerts and extension stats filter on shop_id + stock_quantity threshold.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_shop_stock
  ON products(shop_id, stock_quantity);

-- Sync upserts look up products by (shop_id, marketplace_product_id)
-- on every sync cycle to decide insert vs update.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_shop_marketplace_product
  ON products(shop_id, marketplace_product_id);

-- Sync upserts look up orders by (shop_id, order_id_external)
-- on every sync cycle for conflict resolution.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_shop_order_external
  ON orders(shop_id, order_id_external);
