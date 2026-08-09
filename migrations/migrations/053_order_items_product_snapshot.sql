-- Snapshot the ordered product's identity onto order_items so a notification /
-- analytics line can name what was ordered even when product_id never linked to
-- a products row (multi-product shops where the order item's skuId didn't match
-- a synced product). The products join stays primary; these are the fallback.
-- Idempotent.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS title         text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku           text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_color text;
