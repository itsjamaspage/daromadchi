-- 067_yandex_product_name.sql
-- Capture the netting report's «Название товара (к начислению) или услуги (к
-- удержанию)» column so the Payouts page can show the Yandex product name exactly
-- as the seller's finance report prints it — instead of a catalog-matched title.
--
-- The column holds the product name on sale (Начисление) rows and a service name
-- on fee (Удержание) rows; lib/db/payouts.ts only reads it from the sale line.
--
-- Additive + nullable: no backfill required to deploy. Existing rows read NULL
-- (Payouts falls back to the SKU→catalog name) until the next netting sync
-- repopulates them. Populated by lib/yandex/settlements-sync.ts.

ALTER TABLE yandex_settlement_transactions
  ADD COLUMN IF NOT EXISTS product_name TEXT;
