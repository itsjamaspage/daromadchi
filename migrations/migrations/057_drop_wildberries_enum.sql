-- 057_drop_wildberries_enum.sql
-- Remove 'wildberries' from the marketplace_type enum after the Wildberries
-- integration was deleted from the app.
--
-- HIGH-STAKES: this ALTERs the marketplace column on 6 live tables (incl. orders
-- and shops). Take a fresh DB backup before applying. Apply MANUALLY.
--
-- Safety properties:
--   * Idempotent — the whole thing is guarded on 'wildberries' still being a
--     value of the enum; a second run (e.g. the auto-deploy re-running the
--     registered migration) is a clean no-op.
--   * Atomic — wrapped in a single transaction / DO block, so any failure rolls
--     back completely with nothing partially applied.
--   * Fails LOUD, not destructive — only the meaningless derived
--     unit_economics_items rows are deleted. The enum recast below throws
--     ("invalid input value for enum marketplace_type: wildberries") and rolls
--     back if any REAL row (orders/shops/logs) still uses 'wildberries', rather
--     than silently dropping order/shop history. Expected live count: 0 in
--     orders/shops, 1 in unit_economics_items.

BEGIN;

DO $$
DECLARE
  orphan_count integer;
BEGIN
  -- Idempotent guard: only proceed while 'wildberries' is still an enum value.
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'marketplace_type' AND e.enumlabel = 'wildberries'
  ) THEN
    RAISE NOTICE '057: wildberries already removed from marketplace_type — skipping.';
    RETURN;
  END IF;

  -- Clear the meaningless derived rows tagged wildberries (the integration is
  -- gone). Reported before deletion. Only unit_economics_items is expected to
  -- have any; a real row anywhere else makes the recast below fail and roll back.
  SELECT count(*) INTO orphan_count FROM unit_economics_items WHERE marketplace = 'wildberries';
  RAISE NOTICE '057: deleting % unit_economics_items row(s) with marketplace=wildberries', orphan_count;
  DELETE FROM unit_economics_items WHERE marketplace = 'wildberries';

  -- Rebuild the enum without 'wildberries': rename the old type aside, create the
  -- new one, recast every dependent column, then drop the old type.
  ALTER TYPE marketplace_type RENAME TO marketplace_type_old;
  CREATE TYPE marketplace_type AS ENUM ('uzum', 'yandex_market');

  ALTER TABLE orders               ALTER COLUMN marketplace TYPE marketplace_type USING marketplace::text::marketplace_type;
  ALTER TABLE shops                ALTER COLUMN marketplace TYPE marketplace_type USING marketplace::text::marketplace_type;
  ALTER TABLE unit_economics_items ALTER COLUMN marketplace TYPE marketplace_type USING marketplace::text::marketplace_type;
  ALTER TABLE stock_write_log      ALTER COLUMN marketplace TYPE marketplace_type USING marketplace::text::marketplace_type;
  ALTER TABLE order_cancel_log     ALTER COLUMN marketplace TYPE marketplace_type USING marketplace::text::marketplace_type;
  ALTER TABLE stock_notify_state   ALTER COLUMN marketplace TYPE marketplace_type USING marketplace::text::marketplace_type;

  DROP TYPE marketplace_type_old;
  RAISE NOTICE '057: marketplace_type rebuilt as (uzum, yandex_market).';
END $$;

COMMIT;
