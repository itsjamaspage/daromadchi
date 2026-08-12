-- 064_atmos_billing.sql
-- ATMOS payment-gateway integration (Phase 1): subscriptions table + additive
-- ATMOS columns on payments. No card data is stored in Phase 1; card_* columns
-- are RESERVED for Phase 2 recurring and stay unused/unwritten.
--
-- Additive + idempotent (CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- guarded enum creation) — safe to re-run.

-- subscription status enum (guarded)
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('pending', 'active', 'past_due', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan                 text NOT NULL,
  interval             text NOT NULL,
  status               subscription_status NOT NULL DEFAULT 'pending',
  current_period_end   timestamptz,
  card_id              text,               -- Phase 2 (recurring) — reserved
  card_token_encrypted text,               -- Phase 2 (recurring) — reserved
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx  ON subscriptions (status);

-- Additive ATMOS columns on the existing payments table.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS ext_id               uuid DEFAULT gen_random_uuid();
ALTER TABLE payments ADD COLUMN IF NOT EXISTS account              text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_tiyin         integer;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS atmos_transaction_id text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS atmos_invoice_token  text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS ofd_url              text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS subscription_id      uuid;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS raw_callback         jsonb;

-- ext_id is the idempotency key: unique so one intent maps to exactly one row.
CREATE UNIQUE INDEX IF NOT EXISTS payments_ext_id_unique ON payments (ext_id);
-- account is the callback lookup key.
CREATE INDEX IF NOT EXISTS payments_account_idx ON payments (account);
