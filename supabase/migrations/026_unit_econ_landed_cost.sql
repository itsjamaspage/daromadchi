-- Per-unit landed cost (cargo/customs/freight from the supplier, e.g. China)
-- for Unit Economics items. Kept separate from cost_price (purchase price) so
-- profit/margin reflect the true landed cost.
-- Idempotent: safe to run repeatedly.

ALTER TABLE unit_economics_items ADD COLUMN IF NOT EXISTS landed_cost numeric;
