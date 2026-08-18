-- 074: store each account's turnover-derived tier RECOMMENDATION.
--
-- Deliberately NOT users.plan. users.plan is entitlement — what the seller paid
-- for — and is written only by payment settlement and expiry. These columns are
-- advisory: they drive the upgrade prompt and the outreach popup, and nothing
-- in hasFeature() reads them. Writing a turnover-derived tier into users.plan
-- would grant paid features to a free account on turnover alone.
--
-- All three are nullable: NULL means "not computed yet", which is distinct from
-- "computed, and the answer is free". A seller whose tier has never been
-- computed must not be nudged as though they had just crossed a threshold.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS only. No backfill — the cron fills these
-- on its next run, and inventing a value here would fire the nudge branches
-- against a tier nobody measured.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS derived_tier text,
  ADD COLUMN IF NOT EXISTS derived_turnover_som numeric,
  ADD COLUMN IF NOT EXISTS derived_tier_computed_at timestamptz;
