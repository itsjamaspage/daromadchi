-- 041_shops_stock_poll.sql
-- Phase 3: tiered Uzum order-change poller state. `last_orders_count` is the
-- last CREATED-order count seen; a change is the trigger to run Step A/B for
-- that shop. `stock_poll_at` records the last poll so low-risk shops can be
-- polled less often. Idempotent.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS last_orders_count integer,
  ADD COLUMN IF NOT EXISTS stock_poll_at     timestamptz;
