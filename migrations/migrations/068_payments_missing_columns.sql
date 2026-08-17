-- 068_payments_missing_columns.sql
-- PROD FIX: the live payments table predates several BASE columns that
-- lib/db/schema.ts and app/api/billing/atmos/create/route.ts reference. The
-- create-route INSERT failed on prod with:
--   column "provider" of relation "payments" does not exist
-- Migration 064 only ADDED the ATMOS columns and assumed provider / period_months
-- / updated_at already existed from an older base migration — on prod they don't.
--
-- Comparing schema.ts against the live table, these columns were missing (types
-- read verbatim from schema.ts, NOT guessed):
--   provider                TEXT        NOT NULL            (schema: notNull, no default)
--   provider_transaction_id TEXT        (nullable)
--   period_months           INTEGER     NOT NULL DEFAULT 1  (schema: .default(1).notNull())
--   updated_at              TIMESTAMPTZ NOT NULL DEFAULT now() (schema: .defaultNow().notNull())
--
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS). Nothing is dropped or renamed.
-- NOT NULL columns are added WITH a backfill default so existing rows stay valid on
-- a non-empty table; `provider` then drops its default to match the schema exactly
-- (the app always supplies provider='atmos' on insert — the only provider in Phase 1).

ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_transaction_id text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS period_months           integer     NOT NULL DEFAULT 1;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at              timestamptz NOT NULL DEFAULT now();

-- provider: backfill any existing rows to 'atmos', then drop the default so the
-- final column state matches schema.ts (NOT NULL, no default). Both statements are
-- idempotent — a re-run leaves the already-defaultless column untouched.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'atmos';
ALTER TABLE payments ALTER COLUMN provider DROP DEFAULT;
