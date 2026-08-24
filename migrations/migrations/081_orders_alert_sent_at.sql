-- When the "🛒 Новый заказ — нужно собрать и отправить" alert was sent for an order.
--
-- The alert gate (#299) evaluates only orders being INSERTED this tick. A
-- prepaid Yandex order is first seen as UNPAID, which is correctly not
-- alert-worthy; when it is paid a few minutes later it has become an UPDATE, and
-- the gate never looks there. The order is missed PERMANENTLY — once the row
-- exists it can never re-enter the insert set, so no later tick can rescue it.
--
-- Fixing that means evaluating the gate on updates too, which needs a dedup
-- marker: the sync process is stateless across ticks, so there is no in-memory
-- way to know an alert already went out. This column is that marker.
--
-- NOT a timestamp we display — it exists to be non-NULL. Storing the time
-- rather than a boolean costs nothing and answers "when did we tell them?",
-- which no stored data can answer today (there is no alert log anywhere).
--
-- Idempotent: every registered migration re-runs on every deploy.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS alert_sent_at timestamptz;

-- Backfilled to NULL, and that is deliberate but NOT free: every existing order
-- reads as "never alerted". Orders already past a fulfilment-required status are
-- unaffected — the gate checks the CURRENT raw status, and a delivered or
-- cancelled order does not qualify no matter what this column says. The only
-- rows that could re-alert are ones sitting in PROCESSING/STARTED or
-- PROCESSING/READY_TO_SHIP right now, which are precisely the orders the seller
-- still has to ship. Re-announcing those once is the safe direction.
CREATE INDEX IF NOT EXISTS orders_alert_sent_at_idx
  ON orders (shop_id)
  WHERE alert_sent_at IS NULL;
