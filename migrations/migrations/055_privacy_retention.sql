-- 055_privacy_retention.sql
-- Supports: (a) 30-day post-cancellation account retention/purge, and
--           (b) survival of payment/tax records across account deletion.
--
-- Apply MANUALLY before enabling the retention purge cron
-- (RETENTION_PURGE_ENABLED). The purge route is written to fail-safe if this
-- has NOT been applied (its pre-delete `UPDATE payments SET user_id = NULL`
-- errors while the column is still NOT NULL, so no user is deleted), but the
-- intended state is this migration applied first.

-- ── (a) Cancellation timestamp for the retention clock ───────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_cancelled_at timestamptz;

-- ── (b) Preserve payments across user deletion ───────────────────────────────
-- Drop whatever FK currently constrains payments.user_id (name may vary by how
-- the table was first created), make the column nullable, and re-add the FK as
-- ON DELETE SET NULL so deleting a user keeps the payment row (link severed).
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT con.conname INTO fk_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
  WHERE con.contype = 'f'
    AND rel.relname = 'payments'
    AND att.attname = 'user_id';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE payments
  ADD CONSTRAINT payments_user_id_users_id_fk
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
