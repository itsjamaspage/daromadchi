-- Password reset tokens for the nodemailer-based reset flow that replaces
-- Supabase Auth's resetPasswordForEmail. Idempotent per apply-sql-migrations
-- convention: safe to re-run.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token       text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  expires_at  timestamp   NOT NULL,
  used_at     timestamp,
  created_at  timestamp   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
  ON password_reset_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
  ON password_reset_tokens (expires_at);
