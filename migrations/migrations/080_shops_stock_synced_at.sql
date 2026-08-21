-- Stock refresh runs on its own clock, independent of the plan-gated heavy pass.
--
-- last_synced_at means "the heavy pass ran" and advances only on a heavy tick,
-- so it cannot also mean "stock is current" without one of the two lying. This
-- column is the stock clock and nothing else reads or writes it.
--
-- Idempotent: every registered migration re-runs on every deploy.
ALTER TABLE shops ADD COLUMN IF NOT EXISTS stock_synced_at timestamptz;

-- Backfilled to NULL on purpose: a NULL reads as "never refreshed", so the very
-- first tick after deploy refreshes every shop instead of waiting out an
-- interval measured from a timestamp that never existed.
