-- 103_drop_yandex_market.sql
-- Remove Yandex Market after it exited Uzbekistan on 10 November 2026 and the
-- integration was deleted from the app.
--
-- HIGH-STAKES: this DELETES real seller data (Yandex shops, orders, order_items,
-- products and settlement rows) and ALTERs the marketplace column on 7 live
-- tables. TAKE A FRESH DB BACKUP BEFORE APPLYING. APPLY MANUALLY — this file is
-- deliberately NOT registered in scripts/apply-sql-migrations.mjs, so a deploy
-- will never run it for you.
--
--   psql "$DATABASE_URL" -f migrations/migrations/103_drop_yandex_market.sql
--
-- Why it deletes rather than fails loud (unlike 057, which dropped Wildberries):
-- Wildberries was never synced server-side, so a real row anywhere outside
-- unit_economics_items meant something was wrong. Yandex WAS a live
-- integration, so real orders/products/shops are expected. The enum value
-- cannot be dropped while any row still uses it, so those rows go first. That
-- is a one-way door: everything Yandex-related is gone afterwards, and only the
-- backup can bring it back.
--
-- Safety properties:
--   * Idempotent — the whole thing is guarded on 'yandex_market' still being a
--     value of the enum; a second run is a clean no-op.
--   * Atomic — one transaction / DO block, so any failure rolls back completely
--     with nothing partially applied.
--   * Reports what it deletes — every DELETE is counted and RAISE NOTICE'd
--     before it runs, so the output is a record of what was removed.
--
-- What this does NOT touch: Uzum data of any kind, and the historical audit
-- rows in stock_write_log / order_cancel_log / stock_ledger for Uzum shops.

BEGIN;

DO $$
DECLARE
  n_shops       integer;
  n_orders      integer;
  n_items       integer;
  n_products    integer;
  n_ue          integer;
  n_settle      integer;
  n_prodwrite   integer;
  n_notify      integer;
  n_writelog    integer;
  n_cancellog   integer;
  n_ledger      integer;
BEGIN
  -- Idempotent guard: only proceed while 'yandex_market' is still an enum value.
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'marketplace_type' AND e.enumlabel = 'yandex_market'
  ) THEN
    RAISE NOTICE '103: yandex_market already removed from marketplace_type — skipping.';
    RETURN;
  END IF;

  -- ── 1. Count everything first, so the notices below are a complete record ──
  SELECT count(*) INTO n_shops FROM shops WHERE marketplace = 'yandex_market';

  SELECT count(*) INTO n_orders
    FROM orders WHERE marketplace = 'yandex_market'
       OR shop_id IN (SELECT id FROM shops WHERE marketplace = 'yandex_market');

  SELECT count(*) INTO n_items
    FROM order_items
   WHERE order_id IN (
           SELECT id FROM orders
            WHERE marketplace = 'yandex_market'
               OR shop_id IN (SELECT id FROM shops WHERE marketplace = 'yandex_market'));

  SELECT count(*) INTO n_products
    FROM products
   WHERE shop_id IN (SELECT id FROM shops WHERE marketplace = 'yandex_market');

  SELECT count(*) INTO n_ue FROM unit_economics_items WHERE marketplace = 'yandex_market';
  SELECT count(*) INTO n_notify    FROM stock_notify_state WHERE marketplace = 'yandex_market';
  SELECT count(*) INTO n_writelog  FROM stock_write_log    WHERE marketplace = 'yandex_market';
  SELECT count(*) INTO n_cancellog FROM order_cancel_log   WHERE marketplace = 'yandex_market';
  SELECT count(*) INTO n_ledger    FROM stock_ledger       WHERE marketplace = 'yandex_market';

  SELECT count(*) INTO n_settle    FROM yandex_settlement_transactions;
  SELECT count(*) INTO n_prodwrite FROM product_write_log;

  RAISE NOTICE '103: deleting — shops=%, orders=%, order_items=%, products=%, unit_economics_items=%',
    n_shops, n_orders, n_items, n_products, n_ue;
  RAISE NOTICE '103: deleting — stock_notify_state=%, stock_write_log=%, order_cancel_log=%, stock_ledger=%',
    n_notify, n_writelog, n_cancellog, n_ledger;
  RAISE NOTICE '103: dropping tables — yandex_settlement_transactions (% rows), product_write_log (% rows)',
    n_settle, n_prodwrite;

  -- ── 2. Yandex-only tables ───────────────────────────────────────────────────
  -- yandex_settlement_transactions: raw rows from Yandex's united-netting report.
  -- product_write_log: the audit trail of the Yandex-only product-write path
  -- (lib/marketplace/product-writer.ts), which no longer exists.
  DROP TABLE IF EXISTS yandex_settlement_transactions;
  DROP TABLE IF EXISTS product_write_log;

  -- ── 3. Rows keyed to Yandex ─────────────────────────────────────────────────
  -- order_items first (FK to orders), then orders, then products, then shops.
  DELETE FROM order_items
   WHERE order_id IN (
           SELECT id FROM orders
            WHERE marketplace = 'yandex_market'
               OR shop_id IN (SELECT id FROM shops WHERE marketplace = 'yandex_market'));

  DELETE FROM orders
   WHERE marketplace = 'yandex_market'
      OR shop_id IN (SELECT id FROM shops WHERE marketplace = 'yandex_market');

  DELETE FROM products
   WHERE shop_id IN (SELECT id FROM shops WHERE marketplace = 'yandex_market');

  DELETE FROM unit_economics_items WHERE marketplace = 'yandex_market';
  DELETE FROM stock_notify_state   WHERE marketplace = 'yandex_market';
  DELETE FROM stock_write_log      WHERE marketplace = 'yandex_market';
  DELETE FROM order_cancel_log     WHERE marketplace = 'yandex_market';
  DELETE FROM stock_ledger         WHERE marketplace = 'yandex_market';

  -- Shops last: every table above either references shops or is keyed by
  -- marketplace, so deleting shops first would rely on cascade ordering.
  DELETE FROM shops WHERE marketplace = 'yandex_market';

  -- ── 4. Yandex-only columns ──────────────────────────────────────────────────
  --   shops.business_id               — the Yandex businessId (netting scope)
  --   shops.yandex_boost_disabled_at  — Yandex boost-report cooldown
  --   shops.campaign_placement        — cached Yandex campaign placementType
  --   products.market_warehouse_id    — warehouseId the Yandex stock PUT targeted
  --   stock_write_log.warehouse_id    — same, on the audit row
  ALTER TABLE shops    DROP COLUMN IF EXISTS business_id;
  ALTER TABLE shops    DROP COLUMN IF EXISTS yandex_boost_disabled_at;
  ALTER TABLE shops    DROP COLUMN IF EXISTS campaign_placement;
  ALTER TABLE products DROP COLUMN IF EXISTS market_warehouse_id;
  ALTER TABLE stock_write_log DROP COLUMN IF EXISTS warehouse_id;

  -- ── 5. Legacy 'fby' fulfilment rows ─────────────────────────────────────────
  -- FBY is Fulfilment-by-Yandex. Any row still carrying it belongs to a shop
  -- that is gone by now; NULL reads as "unknown", which the stock aggregation
  -- treats as FBS — the same default it already applies to unknown rows.
  UPDATE products SET fulfillment_type = NULL WHERE fulfillment_type = 'fby';
  UPDATE orders   SET fulfillment_type = NULL WHERE fulfillment_type = 'fby';

  -- ── 6. Rebuild the enum without 'yandex_market' ─────────────────────────────
  -- Rename the old type aside, create the new one, recast every dependent
  -- column, then drop the old type. If any row above was missed, the recast
  -- throws ("invalid input value for enum marketplace_type: yandex_market") and
  -- the whole transaction rolls back rather than losing data silently.
  ALTER TYPE marketplace_type RENAME TO marketplace_type_old;
  CREATE TYPE marketplace_type AS ENUM ('uzum');

  ALTER TABLE shops                ALTER COLUMN marketplace TYPE marketplace_type USING marketplace::text::marketplace_type;
  ALTER TABLE orders               ALTER COLUMN marketplace TYPE marketplace_type USING marketplace::text::marketplace_type;
  ALTER TABLE unit_economics_items ALTER COLUMN marketplace TYPE marketplace_type USING marketplace::text::marketplace_type;
  ALTER TABLE stock_write_log      ALTER COLUMN marketplace TYPE marketplace_type USING marketplace::text::marketplace_type;
  ALTER TABLE order_cancel_log     ALTER COLUMN marketplace TYPE marketplace_type USING marketplace::text::marketplace_type;
  ALTER TABLE stock_notify_state   ALTER COLUMN marketplace TYPE marketplace_type USING marketplace::text::marketplace_type;
  ALTER TABLE stock_ledger         ALTER COLUMN marketplace TYPE marketplace_type USING marketplace::text::marketplace_type;

  DROP TYPE marketplace_type_old;

  -- ── 7. Free-text marketplace columns ────────────────────────────────────────
  -- category_aliases / suggested_aliases store the marketplace as plain text,
  -- so they are not covered by the recast above. The alias rows seeded for
  -- Yandex no longer match anything.
  DELETE FROM category_aliases   WHERE marketplace = 'yandex_market';
  DELETE FROM suggested_aliases  WHERE marketplace = 'yandex_market';

  RAISE NOTICE '103: marketplace_type rebuilt as (uzum). Yandex Market removed.';
END $$;

COMMIT;
