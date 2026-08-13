-- 065_stock_ledger.sql
-- Event-sourced on-hand ledger for the FBS shared pool. Fixes the missing
-- decrement: products.physical_stock only ever mirrored each marketplace's own
-- listing, so a sale on one marketplace never debited the shared pool — both
-- rows sat stale-high and the sync re-propagated the pre-sale number. This
-- ledger is the AUTHORITATIVE on-hand for a cross-marketplace SKU group
-- (match_key): every real movement is one append-only row, on_hand = SUM(delta).
--
-- Decisions locked with the owner:
--   • Debit at PLACEMENT, anchored to new-order detection (Option A) — the event
--     that already works, not a handover/delivered status transition (the kind
--     that gets missed). The reservation and the debit are ONE event, so
--     available = max(0, on_hand) with no separate pending term. A missed CREDIT
--     (cancel/return) leaves on_hand too low → undersell, never oversell.
--   • Returns credit back ONLY when the unit re-enters sellable stock.
--   • Seed is seller-confirmed.
--
-- Additive + idempotent (guarded enum, CREATE ... IF NOT EXISTS) — safe to re-run.

DO $$ BEGIN
  CREATE TYPE stock_ledger_reason AS ENUM ('seed', 'consume', 'return', 'cancel', 'manual');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS stock_ledger (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_key         text NOT NULL,
  delta             integer NOT NULL,
  reason            stock_ledger_reason NOT NULL,
  order_id_external text,
  marketplace       marketplace_type,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Idempotency for order-driven events: at most one (consume|return|cancel) per
-- (user, group, reason, order). seed/manual carry a NULL order_id_external and
-- Postgres treats NULLs as distinct, so multiple manual corrections are allowed.
CREATE UNIQUE INDEX IF NOT EXISTS stock_ledger_user_key_reason_order_unique
  ON stock_ledger (user_id, match_key, reason, order_id_external);
CREATE INDEX IF NOT EXISTS stock_ledger_user_key_idx ON stock_ledger (user_id, match_key);
CREATE INDEX IF NOT EXISTS stock_ledger_created_at_idx ON stock_ledger (created_at);
