-- 104_drop_yandex_schema_leftovers.sql
-- Keeps the Yandex schema objects dropped once 103 has removed them.
--
-- WHY THIS IS NEEDED (found by actually running 103, not by reading it)
-- --------------------------------------------------------------------
-- scripts/apply-sql-migrations.mjs re-runs EVERY registered migration on every
-- deploy, and the migrations that created the Yandex objects are all written
-- `IF NOT EXISTS` so that re-running is safe. That is exactly what makes them
-- resurrect what 103 dropped:
--
--   030_shops_business_id.sql        → shops.business_id
--   035_yandex_settlements.sql       → yandex_settlement_transactions
--   051_shops_yandex_boost_disabled  → shops.yandex_boost_disabled_at
--   096_product_write_log.sql        → product_write_log
--   098_shop_campaign_placement.sql  → shops.campaign_placement
--   038_stock_sync_mode.sql          → products.market_warehouse_id
--
-- Verified: on a database rebuilt to the pre-removal production shape, 103 left
-- the schema clean, and the very next `node scripts/apply-sql-migrations.mjs`
-- brought back both tables and four of the columns. No DATA returns (the enum
-- stays uzum-only, and nothing writes these), but the cleanup was silently half
-- undone — the kind of thing nobody notices for weeks.
--
-- 038 cannot simply be unregistered: it also creates the stock-sync machinery
-- that is still in use. So rather than rewrite applied history, this runs LAST
-- and re-drops whatever the earlier ones put back.
--
-- SAFE TO REGISTER, unlike 103:
--   * It is GUARDED on 103 having already run. While 'yandex_market' is still a
--     value of marketplace_type, this is a no-op — so a deploy can never drop a
--     table that still holds a seller's Yandex settlements.
--   * It only ever drops SCHEMA objects that 103 already dropped. It deletes no
--     rows and makes no decision 103 has not already made.
--   * Idempotent and convergent: once the objects are gone it finds nothing to
--     do, and if a future deploy recreates one it is dropped again.

BEGIN;

DO $$
BEGIN
  -- The gate: 'yandex_market' still present means 103 has NOT been applied, so
  -- real Yandex data may still be in these tables. Do nothing.
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'marketplace_type' AND e.enumlabel = 'yandex_market'
  ) THEN
    RAISE NOTICE '104: 103 has not been applied yet — leaving the Yandex schema in place.';
    RETURN;
  END IF;

  -- 103 has run. Re-drop anything an earlier registered migration recreated.
  DROP TABLE IF EXISTS yandex_settlement_transactions;
  DROP TABLE IF EXISTS product_write_log;

  ALTER TABLE shops           DROP COLUMN IF EXISTS business_id;
  ALTER TABLE shops           DROP COLUMN IF EXISTS yandex_boost_disabled_at;
  ALTER TABLE shops           DROP COLUMN IF EXISTS campaign_placement;
  ALTER TABLE products        DROP COLUMN IF EXISTS market_warehouse_id;
  ALTER TABLE stock_write_log DROP COLUMN IF EXISTS warehouse_id;

  -- 'fby' is Fulfilment-by-Yandex. Nothing writes it any more; this catches a
  -- row an in-flight sync wrote between the deploy and 103.
  UPDATE products SET fulfillment_type = NULL WHERE fulfillment_type = 'fby';
  UPDATE orders   SET fulfillment_type = NULL WHERE fulfillment_type = 'fby';

  RAISE NOTICE '104: Yandex schema leftovers dropped.';
END $$;

COMMIT;
