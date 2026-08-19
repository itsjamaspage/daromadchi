-- 076: record a cancellation — when it was asked for, and how long access lasts.
--
-- WHY BOTH COLUMNS
--
-- cancelled_at is the audit trail: a seller who says "I cancelled in August"
-- needs a row that agrees with them, and a cancellation is the moment a charging
-- authorisation is withdrawn. status='cancelled' alone loses the date.
--
-- access_until is the PROMISE made at that moment. current_period_end already
-- holds the same date today, but it is the renewal machinery's field and a later
-- write to it would silently move the date a seller was told. Freezing the
-- promise separately is the same reasoning as agreed_amount_tiyin: what we
-- committed to must survive changes to what the system currently computes.
--
-- NULL access_until means "no paid period to honour" — a subscription cancelled
-- before it was ever charged. It is distinguishable from a past date, which
-- means the period genuinely ran out.
--
-- Nothing here changes entitlement. Access continues to run off
-- users.plan_expires_at, which the daily expire-plans job already drops to free
-- once it passes; a cancellation simply stops the renewal from extending it.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS only, no backfill. There is nothing to
-- backfill — no cancellation has ever been recorded, and inventing a date for
-- an existing 'cancelled' row would fabricate an audit trail.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cancelled_at  timestamptz,
  ADD COLUMN IF NOT EXISTS access_until  timestamptz;
