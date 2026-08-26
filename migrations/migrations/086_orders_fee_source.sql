-- 086_orders_fee_source.sql
-- Tell an estimated fee apart from a reported one.
--
-- lib/money treats any non-NULL orders.marketplace_fee as a KNOWN fee — that is
-- the whole point of the Known<T> type: an unknown must never be read as a fact.
-- But lib/uzum/sync.ts has a fallback that DERIVES a fee when Uzum's finance
-- feed returns nothing: it takes (revenue − shop balance) as the total fee and
-- spreads it across orders in proportion to their revenue, then writes the
-- result into marketplace_fee. Nothing distinguished that estimate from a real
-- reported commission, so the money module trusted it absolutely — a back door
-- straight through the guarantee.
--
-- 'reported' — the marketplace told us this figure (Uzum finance feed, or
--              revenue − netPayout from a settlement row, which is arithmetic on
--              real settlement data).
-- 'derived'  — WE estimated it. lib/money treats this as fee_not_reported.
--
-- EXISTING ROWS DEFAULT TO 'reported', deliberately. There is no signal in the
-- data that can tell a historical derived fee from a real one — the fallback
-- left no marker — so the choice is between preserving every current figure or
-- blanking history that is mostly correct. This preserves it: nothing a seller
-- sees changes on deploy. Only writes made from here on are classified honestly.
-- A seller who wants their history reclassified needs a deliberate, reviewed
-- one-off; it is not something a migration should guess at.
--
-- Idempotent.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS fee_source text NOT NULL DEFAULT 'reported';

-- Only the rows lib/money actually reads need the lookup, and only when a fee
-- is present; a partial index keeps this off the hot insert path.
CREATE INDEX IF NOT EXISTS idx_orders_fee_source_derived
  ON orders (shop_id)
  WHERE fee_source = 'derived';
