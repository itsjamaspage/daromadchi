-- 087_orders_reserved_stock_snapshot.sql
-- Snapshot of the on-hand pool (products.physical_stock) captured the first time
-- an order is seen in a reserving status. When a seller accepts an order the
-- marketplace decrements the listing, but physical_stock (the true pool) does
-- not move — so this is the number the listing should be RESTORED to if the
-- order is later cancelled. Feeds the read-only "the listing didn't come back"
-- cancellation alert.
--
-- Write-once in the sync path; NULL for orders never seen reserving or synced
-- before this column existed (deliberately NOT backfilled). Additive + idempotent.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS reserved_stock_snapshot integer;
