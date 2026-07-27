-- Track how each product is fulfilled — the same SKU can be FBS on one
-- marketplace (seller ships from home) and FBO/FBY on another (marketplace
-- warehouse). This lets computeStockGroups aggregate correctly:
--   FBO members → SUM their stocks (independent warehouses, additive)
--   FBS members → MAX of their stocks (same physical pool, not additive)
--
-- Values: 'fbs' | 'fbo' | 'fby' | NULL (unknown → treated as FBS since
-- overcounting inventory is worse than undercounting).
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS fulfillment_type text;
