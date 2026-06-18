-- Index high-traffic query fields to speed up read queries
-- Orders: most queries filter by shop_id and sort/filter by ordered_at or status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_shop_ordered
  ON orders(shop_id, ordered_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_shop_status
  ON orders(shop_id, status);

-- Products: always filtered by shop_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_shop_id
  ON products(shop_id);

-- Order items: joined on order_id and product_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
  ON order_items(order_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_product_id
  ON order_items(product_id);

-- User settings: always looked up by user_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_settings_user_id
  ON user_settings(user_id);

-- Channel nonces: queried by nonce value and cleaned up by expires_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channel_nonces_expires_at
  ON channel_nonces(expires_at);
