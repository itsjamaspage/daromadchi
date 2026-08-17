-- 069_subscription_card_display.sql
-- Direct card-binding billing (replaces the broken hosted-invoice flow). The
-- reusable ATMOS card token drives auto-renewal; it is stored ENCRYPTED in the
-- already-existing subscriptions.card_token_encrypted column (see migration 064).
-- These three columns are DISPLAY-ONLY metadata for a "your card" UI — a masked
-- last-4, the expiry, and the holder name. NO full PAN is ever stored.
--
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS). Nothing dropped or renamed.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS card_last4  text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS card_expiry text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS card_holder text;
