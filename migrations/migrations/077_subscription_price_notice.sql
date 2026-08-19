-- 077: a price change a subscriber has been told about, not yet charged.
--
-- The rule this exists to enforce: NOBODY IS CHARGED A NEW AMOUNT THEY WERE NOT
-- TOLD ABOUT IN ADVANCE. agreed_amount_tiyin (migration 072) already stops the
-- renewal charging whatever the config currently says; this is the only
-- sanctioned way that agreed amount ever moves.
--
--   pending_amount_tiyin   the new price, staged. NOT charged while it lives
--                          here — the renewal keeps billing agreed_amount_tiyin.
--   pending_effective_date the first renewal it may apply to.
--   pending_notified_at    when the seller was actually told, by a channel that
--                          confirmed delivery.
--
-- WHY notified_at IS A COLUMN AND NOT AN ASSUMPTION
--
-- It is the evidence. The renewal refuses the new amount unless this is set and
-- old enough (lib/billing/price-notice.ts, PRICE_NOTICE_DAYS), so a staged
-- increase that was never delivered simply never charges: the seller keeps
-- paying what they agreed to. A boolean "we sent it" flag could not answer "how
-- long before the charge", which is the part that makes the notice advance
-- notice.
--
-- Promotion (pending -> agreed) happens only AFTER a successful charge at the
-- new amount, so a failed charge leaves the old agreed price intact and the
-- notice still standing.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS only. No backfill — no price change has
-- ever been scheduled, and inventing one would stage a charge nobody approved.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS pending_amount_tiyin   integer,
  ADD COLUMN IF NOT EXISTS pending_effective_date timestamptz,
  ADD COLUMN IF NOT EXISTS pending_notified_at    timestamptz;

-- Lets the daily notice sweep find "staged but not yet told" without scanning
-- every subscription.
CREATE INDEX IF NOT EXISTS subscriptions_pending_notice_idx
  ON subscriptions (pending_effective_date)
  WHERE pending_amount_tiyin IS NOT NULL AND pending_notified_at IS NULL;
