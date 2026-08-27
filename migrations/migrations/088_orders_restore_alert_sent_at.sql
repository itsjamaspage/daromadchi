-- 088_orders_restore_alert_sent_at.sql
-- At-most-once marker for the read-only "restore your listing after cancel"
-- alert (Part 2). Set when the seller is told that a cancelled order's listing
-- did not come back on its own. NULL = not told. Same role alert_sent_at /
-- cancel_alert_sent_at play for their alerts. Additive + idempotent.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS restore_alert_sent_at timestamptz;
