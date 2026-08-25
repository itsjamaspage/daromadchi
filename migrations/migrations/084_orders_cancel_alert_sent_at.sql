-- When we told the seller that an order they were asked to ship was CANCELLED.
--
-- The alert gate (#299/#306) announces "🛒 new order — collect and ship" and
-- then goes quiet forever. A prepaid Yandex order can be announced and then
-- cancelled before delivery (order 60810362177: paid, alerted, «Заказ отменён
-- до доставки»), and the seller is left hunting their marketplace account for
-- an order that no longer exists. The app told them to act and never told them
-- to stop.
--
-- Same shape and the same reasoning as alert_sent_at (migration 081): the sync
-- is stateless across ticks, so "already told them it was cancelled" has to
-- live on the row. Without it the cancellation notice would re-fire every five
-- minutes for as long as the order stays cancelled — which is forever.
--
-- NOT a timestamp we display. It exists to be non-NULL, and storing the time
-- rather than a boolean costs nothing and answers "when did we tell them?".
--
-- Idempotent: every registered migration re-runs on every deploy.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_alert_sent_at timestamptz;

-- Backfilled to NULL, and that is deliberate. Every existing cancelled order
-- reads as "not yet told" — but the notice only fires for orders we ALERTED
-- about (alert_sent_at IS NOT NULL), and only while they are inside the sync
-- window the syncs re-read. Older cancellations are never revisited, so this
-- cannot become a burst of notices about orders the seller stopped caring
-- about weeks ago.
CREATE INDEX IF NOT EXISTS orders_cancel_alert_pending_idx
  ON orders (shop_id)
  WHERE alert_sent_at IS NOT NULL AND cancel_alert_sent_at IS NULL;
