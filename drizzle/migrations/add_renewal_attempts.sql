-- Renewal attempts audit log (table 35 in schema.ts)
-- Tracks every auto-renewal attempt: success, failure, dry-run, skip.

CREATE TABLE IF NOT EXISTS renewal_attempts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id      UUID NOT NULL,
  user_id              UUID,
  payment_id           UUID,
  plan                 TEXT NOT NULL,
  interval             TEXT NOT NULL,
  amount_tiyin         INTEGER,
  dry_run              BOOLEAN NOT NULL DEFAULT false,
  outcome              TEXT NOT NULL,
  atmos_transaction_id TEXT,
  error                TEXT,
  source               TEXT NOT NULL DEFAULT 'cron',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS renewal_attempts_subscription_id_idx ON renewal_attempts (subscription_id);
CREATE INDEX IF NOT EXISTS renewal_attempts_outcome_idx ON renewal_attempts (outcome);
CREATE INDEX IF NOT EXISTS renewal_attempts_created_at_idx ON renewal_attempts (created_at);
