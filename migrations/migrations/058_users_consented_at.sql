-- 058_users_consented_at.sql
-- Records that a user agreed to the Privacy Policy, Terms of Use and Cookie
-- Policy at signup — the lawful-consent evidence required by Uzbekistan's
-- personal-data law (ZRU-547). Set on account creation for both the
-- email/password and Google signup paths.
--
-- Additive, nullable, idempotent — safe to re-run. Existing rows (users who
-- registered before this column existed) keep NULL.
ALTER TABLE users ADD COLUMN IF NOT EXISTS consented_at timestamptz;
