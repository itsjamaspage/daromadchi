-- 056_payments_payer_email.sql
-- Retain the payer's email on each payment row for tax/accounting, INDEPENDENT
-- of the users FK. When a user is deleted, payments.user_id is set NULL
-- (migration 055) but payer_email SURVIVES, so a financial record can still be
-- tied to who paid. Snapshotted at payment creation (create-payment route).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + a backfill guarded on payer_email IS
-- NULL, so re-running never overwrites an existing snapshot.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payer_email text;

-- Backfill existing rows from their currently-linked user, while the link still
-- exists, so historical payments carry the payer identity before any future
-- account deletion strips user_id.
UPDATE payments p
SET payer_email = u.email
FROM users u
WHERE p.user_id = u.id
  AND p.payer_email IS NULL;
