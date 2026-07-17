ALTER TABLE users ADD COLUMN IF NOT EXISTS extension_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_extension_token ON users(extension_token) WHERE extension_token IS NOT NULL;
