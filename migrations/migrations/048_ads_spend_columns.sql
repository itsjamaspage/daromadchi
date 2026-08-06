-- 048_ads_spend_columns.sql
-- Ad-spend integration: split product_ads_stats.spend into cash vs. bonus and
-- record which marketplace / source each row came from. Idempotent.
--
-- `spend` (existing column) stays authoritative for the P&L "Реклама" line and
-- is kept equal to cash_spend + bonus_spend by the writers. Yandex boost lands
-- the Взаимозачёт credit in bonus_spend (cash may be 0), so both are stored
-- separately and never collapsed.

ALTER TABLE product_ads_stats ADD COLUMN IF NOT EXISTS marketplace  text;
ALTER TABLE product_ads_stats ADD COLUMN IF NOT EXISTS cash_spend   numeric NOT NULL DEFAULT '0';
ALTER TABLE product_ads_stats ADD COLUMN IF NOT EXISTS bonus_spend  numeric NOT NULL DEFAULT '0';
ALTER TABLE product_ads_stats ADD COLUMN IF NOT EXISTS source_label text;
