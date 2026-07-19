-- Marketplace-reported lifetime units sold per product (Uzum SKU.quantitySold).
-- This includes FBO orders, which the seller API forbids reading at the order
-- level (403 RBAC), so it lets us show an accurate "sold" figure even when we
-- can't fetch the underlying order records. Nullable: populated on next sync.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS quantity_sold integer;
