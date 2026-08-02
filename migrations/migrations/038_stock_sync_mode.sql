-- 038_stock_sync_mode.sql
-- Phase 1 of the opt-in Stock-sync (edit) mode.
--
-- Adds the per-shop posture columns that gate the audited stock-quantity-only
-- writer, plus the product-level identifiers a write needs (Uzum string
-- barcode; Yandex Market shopSku + warehouseId). EVERY existing shop is set to
-- read_only — no current behaviour changes until a user explicitly opts in.
-- Idempotent: safe to re-run (guarded enum creation + IF NOT EXISTS columns).

-- Enum types (guarded — CREATE TYPE has no IF NOT EXISTS).
DO $$ BEGIN
  CREATE TYPE api_mode AS ENUM ('read_only', 'stock_sync');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE oversell_mode AS ENUM ('lock_last_unit', 'partition', 'off');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Shop posture columns.
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS api_mode                 api_mode      NOT NULL DEFAULT 'read_only',
  ADD COLUMN IF NOT EXISTS stock_sync_dry_run       boolean       NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS oversell_mode            oversell_mode NOT NULL DEFAULT 'lock_last_unit',
  ADD COLUMN IF NOT EXISTS primary_channel_priority integer       NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS stock_sync_consent_at    timestamptz;

-- Existing shops keep the current read-only behaviour, explicitly.
UPDATE shops SET api_mode = 'read_only' WHERE api_mode IS NULL;

-- Default channel priority so Uzum is primary (keeps the last unit at qty=1
-- under lock_last_unit). Only touch rows still at the insert default so a
-- re-run never clobbers a user's later choice.
UPDATE shops SET primary_channel_priority = 0
  WHERE marketplace = 'uzum' AND primary_channel_priority = 100;

-- Product-level stock-WRITE identifiers (populated by the Phase 3 sync steps).
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS market_barcode      text,
  ADD COLUMN IF NOT EXISTS market_sku          text,
  ADD COLUMN IF NOT EXISTS market_warehouse_id text;
