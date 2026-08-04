-- 047_products_variant_color.sql
-- Phase 1.5 of variant grouping: the resolved colour key of each variant, so the
-- collapsible variant view can show a per-colour child label ("Цвет: Белый").
-- Stored as the resolveColor key ('white' | 'beige' | …), sourced from Uzum
-- sku.skuTitle / Yandex mapping.marketSkuName by the syncs. Nullable — no known
-- colour → no label. No index (never filtered/grouped on). Idempotent.

ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_color text;
