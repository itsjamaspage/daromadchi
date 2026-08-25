-- Seller-entered values that Daromadchi shows INSTEAD of the marketplace's.
--
-- Cost has always been ours: both syncs deliberately omit cost_price from
-- their UPDATE patches (see the note at lib/uzum/sync.ts:361 — "re-syncs must
-- not clobber hand-entered costs"), so a hand-typed cost survives.
--
-- Price and stock have no such protection, and could not simply be made
-- editable in place:
--   • selling_price is rewritten by both product syncs on every heavy pass
--     (lib/yandex/sync.ts:383, lib/uzum/sync.ts)
--   • stock_quantity is rewritten by the stock refresh every 15 minutes
--     (lib/marketplace/stock-refresh.ts)
-- A seller typing into those columns would watch the number revert within the
-- hour with no explanation. These columns are where their value lives instead,
-- and nothing in the sync path writes them.
--
-- NULL means "no override — show what the marketplace reports". That is the
-- default for every existing row and the state a seller returns to by clearing
-- the field, so the marketplace value is never permanently lost behind an edit.
--
-- LOCAL ONLY. Nothing reads these to build a marketplace request. The one
-- sanctioned outbound write (stock quantity via lib/marketplace/stock-writer.ts)
-- keys off products.stock_quantity and market_barcode/market_sku, none of which
-- this touches — so an override cannot become a push to Uzum or Yandex.
--
-- Idempotent: every registered migration re-runs on every deploy.
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_override numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_override integer;

-- Guard the values rather than trusting the API layer alone: a negative price
-- or stock is not a number anyone meant to type, and the constraint is the one
-- check that a future writer cannot forget.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_price_override_nonneg') THEN
    ALTER TABLE products ADD CONSTRAINT products_price_override_nonneg
      CHECK (price_override IS NULL OR price_override >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_override_nonneg') THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_override_nonneg
      CHECK (stock_override IS NULL OR stock_override >= 0);
  END IF;
END $$;
