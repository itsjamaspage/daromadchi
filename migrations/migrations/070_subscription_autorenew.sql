-- 070_subscription_autorenew.sql
-- Per-subscription auto-renew flag. When true (default), the renewal cron
-- (app/api/cron/billing-renew) charges the stored card token before the period
-- ends; the seller can turn it off from the billing page. Independent of the
-- global BILLING_AUTORENEW_ENABLED kill-switch, which gates the cron entirely.
--
-- Additive + idempotent. Existing rows default to true (renew on).

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS autorenew boolean NOT NULL DEFAULT true;
