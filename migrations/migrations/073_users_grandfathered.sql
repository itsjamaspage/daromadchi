-- 073: mark existing paying accounts as grandfathered.
--
-- Sellers already on the old flat Pro/Pro+ prices keep their price and full
-- access permanently. hasFeature() checks this FIRST, before any plan or trial
-- logic, so a rule written after they subscribed can never gate them.
--
-- ── Idempotency, and why the column is nullable ─────────────────────────────
-- scripts/apply-sql-migrations.mjs re-runs every registered migration on every
-- deploy, so the backfill must decide each row EXACTLY ONCE — otherwise a
-- seller who subscribes next month, on the NEW prices, would be grandfathered
-- by the next deploy and locked to old pricing forever.
--
-- Adding the column with DEFAULT false would fill every existing row with false
-- immediately, losing the distinction between "not yet decided" and "decided:
-- no". So it is added WITHOUT a default: NULL means undecided, the backfill
-- claims only NULLs, and the default is set afterwards for future signups.
-- Re-running finds no NULLs and changes nothing.
--
-- The column stays nullable on purpose. A row inserted between the ADD and the
-- SET DEFAULT would be NULL, and application code treats NULL as "not
-- grandfathered" — correct, since a brand-new account is free anyway.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_grandfathered boolean;

-- Decide every existing row once: anyone on a paid plan today is on old pricing.
UPDATE users
   SET is_grandfathered = (plan <> 'free')
 WHERE is_grandfathered IS NULL;

-- Future signups are not grandfathered.
ALTER TABLE users
  ALTER COLUMN is_grandfathered SET DEFAULT false;
