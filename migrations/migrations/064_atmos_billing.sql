-- 064_atmos_billing.sql
-- ATMOS payment-gateway integration (hosted checkout): subscriptions table +
-- additive ATMOS columns on payments, including a dedicated ATMOS lifecycle state
-- machine (atmos_status) with an at-most-once SUCCESS transition guarded in the
-- application layer. No card data is stored in Phase 1; card_* columns are
-- RESERVED for Phase 2 recurring and stay unused/unwritten.
--
-- Additive + idempotent (CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- guarded enum creation) — safe to re-run on every deploy.

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

-- Dedicated ATMOS payment lifecycle state (guarded). This is the AUTHORITATIVE
-- state machine for a hosted-checkout attempt. It is separate from the legacy
-- payments.status (payment_status: pending|paid|cancelled|failed) which the
-- dashboard payment-history UI still reads; the two are flipped together in the
-- single settle transaction. SUCCESS may be entered at most once (enforced in
-- lib/billing/activate.ts via a conditional UPDATE off a non-final state).
DO $$ BEGIN
  CREATE TYPE atmos_payment_status AS ENUM ('created', 'pending', 'success', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Additive ATMOS columns on the existing payments table. The hosted-checkout
-- flow keys off account (== our internal payment id, echoed back in the callback)
-- and request_id (the create-call idempotency key).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS request_id           uuid DEFAULT gen_random_uuid();
ALTER TABLE payments ADD COLUMN IF NOT EXISTS account              text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_tiyin         integer;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS atmos_payment_id     text;   -- ATMOS invoice payment_id (from create; used by /get)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS atmos_transaction_id text;   -- card transaction_id (from the callback)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS atmos_invoice_token  text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS atmos_status         atmos_payment_status NOT NULL DEFAULT 'created';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmed_at         timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS ofd_url              text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS subscription_id      uuid;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS raw_callback         jsonb;

-- request_id is the create-call idempotency key: unique so one intent maps to
-- exactly one row.
CREATE UNIQUE INDEX IF NOT EXISTS payments_request_id_unique ON payments (request_id);
-- account is the per-attempt reconciliation / callback-lookup key: unique.
CREATE UNIQUE INDEX IF NOT EXISTS payments_account_unique ON payments (account);
CREATE INDEX IF NOT EXISTS payments_atmos_status_idx ON payments (atmos_status);
