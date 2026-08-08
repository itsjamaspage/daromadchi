-- 051_shops_yandex_boost_disabled.sql
-- Yandex Market boost-consolidated (Буст продаж) report cooldown. That report is
-- a SEPARATE permission on the seller's API key; a key without advertising access
-- gets a hard 403 on every generate, which re-fires each cron cycle and floods
-- the seller's "Ошибки · API Маркета" log at 100% error rate. On a 403 we stamp
-- this column and skip boost sync, re-probing only ~weekly so it self-heals if
-- the seller later grants access. Cleared on a successful boost report.
-- Idempotent.

ALTER TABLE shops ADD COLUMN IF NOT EXISTS yandex_boost_disabled_at timestamptz;
