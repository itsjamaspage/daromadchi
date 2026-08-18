-- 072: record the price each subscriber actually agreed to.
--
-- WHY: app/api/cron/billing-renew/route.ts computes the renewal amount with
-- planAmountTiyin(plan, interval) — i.e. from the CURRENT config in
-- lib/billing/plans.ts. Nothing anywhere records what the seller agreed to pay,
-- so editing a plan's price silently reprices every existing subscriber at their
-- next renewal.
--
-- This is not hypothetical. Commit 7d3522f dropped Pro monthly 250 000 -> 50 000
-- for a real-card payment test and 17cdcf9 restored it, so a card that was
-- charged 50 000 so'm would be charged 250 000 at renewal — 5x what was agreed.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, and the backfill only writes rows that
-- are still NULL, so re-running never overwrites a captured price.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS agreed_amount_tiyin integer;

-- Backfill from each subscription's most recent SUCCESSFUL payment — the last
-- amount the seller actually authorised. atmos_status='success' OR status='paid'
-- matches how lib/billing/activate.ts flips the two columns together, and also
-- covers pre-ATMOS legacy rows.
--
-- Subscriptions with no settled payment stay NULL on purpose: they were never
-- charged, so there is no agreed price to honour, and the renewal cron skips
-- them rather than inventing one.
UPDATE subscriptions s
   SET agreed_amount_tiyin = p.amount_tiyin
  FROM (
    SELECT DISTINCT ON (subscription_id)
           subscription_id,
           amount_tiyin
      FROM payments
     WHERE subscription_id IS NOT NULL
       AND amount_tiyin IS NOT NULL
       AND (atmos_status = 'success' OR status = 'paid')
     ORDER BY subscription_id, COALESCE(confirmed_at, created_at) DESC, created_at DESC
  ) p
 WHERE p.subscription_id = s.id
   AND s.agreed_amount_tiyin IS NULL;
