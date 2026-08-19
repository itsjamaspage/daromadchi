-- 078: one row per kind of nudge we have sent a seller.
--
-- WHY A TABLE AND NOT COLUMNS ON users
--
-- Each nudge needs three things: has it been sent, when, and has the seller
-- dismissed the in-app copy. As columns that is three per nudge, and the next
-- nudge is another three. A row per (user, kind) keeps users lean and lets the
-- enterprise-outreach branch add a kind without a migration.
--
-- ONE ROW PER KIND, NOT A LOG
--
-- The unique index is the throttle: a sweep that runs daily must not tell the
-- same seller the same thing every morning. Re-sending updates sent_at and
-- clears dismissed_at, so "when were they last told" is always one lookup, and
-- a nudge the seller dismissed can legitimately return later when the condition
-- recurs.
--
-- This is deliberately NOT the record for price changes. That one is legal
-- evidence and lives on the subscription itself (migration 077), where it
-- cannot be throttled, overwritten or dismissed away.
--
-- detail carries what the seller was actually shown — the turnover figure, the
-- tier we suggested — so an operator answering "why did I get this?" can see the
-- numbers behind it rather than re-deriving them from a moving average.
--
-- Idempotent: IF NOT EXISTS throughout, no backfill. A backfilled row would mark
-- a nudge as already sent and silence the first real one.

CREATE TABLE IF NOT EXISTS user_notices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         text NOT NULL,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  -- NULL until the seller dismisses the in-app banner. Telegram delivery is
  -- separate: sent_at records that we told them, dismissed_at that they read it.
  dismissed_at timestamptz,
  detail       jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_notices_user_kind_idx
  ON user_notices (user_id, kind);

-- The in-app banner asks "what should this seller see right now", which is the
-- newest undismissed row for them.
CREATE INDEX IF NOT EXISTS user_notices_active_idx
  ON user_notices (user_id, sent_at DESC)
  WHERE dismissed_at IS NULL;
