-- Shared inventory: a single physical stock pool across all marketplaces for the same SKU.
-- Users set physical_stock once; available stock = physical_stock - total sold across all shops.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS physical_stock int;

-- Fast SKU-based lookups for cross-marketplace stock sharing
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products (sku) WHERE sku IS NOT NULL;
