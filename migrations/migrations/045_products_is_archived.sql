-- 045_products_is_archived.sql
-- Uzum's product-list API returns archived products; the sync read none of the
-- archived flags, so they inserted as active and cluttered every default view.
-- This adds a boolean the sync now populates. NOT NULL DEFAULT false is correct
-- here (unlike a first-seen timestamp): existing rows read as active until the
-- next sync re-evaluates them from the card/SKU archived flags. Idempotent.

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Default views filter shop_id + is_archived=false; composite index keeps them fast.
CREATE INDEX IF NOT EXISTS products_shop_archived_idx ON products (shop_id, is_archived);
