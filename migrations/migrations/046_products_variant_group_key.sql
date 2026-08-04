-- 046_products_variant_group_key.sql
-- Phase 1 of variant grouping: a nullable key that groups colour/size variants
-- of one parent product. Namespaced per marketplace by the sync
-- ('uzum:<card.productId>' | 'yandex:<marketModelName>') so keys never collide
-- across marketplaces. Nullable — single-variant products may have none.
-- No view uses it yet; it's pure data foundation. Idempotent.

ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_group_key text;

-- Grouped queries filter by shop and group by key. (products has no marketplace
-- column — it lives on shops — and shop_id already implies the marketplace, so
-- the index is (shop_id, variant_group_key).)
CREATE INDEX IF NOT EXISTS products_shop_variant_group_idx
  ON products (shop_id, variant_group_key);
