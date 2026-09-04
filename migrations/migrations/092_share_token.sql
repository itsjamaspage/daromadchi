ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS share_token TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'user_settings_share_token_unique'
  ) THEN
    CREATE UNIQUE INDEX user_settings_share_token_unique ON user_settings (share_token) WHERE share_token IS NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_settings_share_token'
  ) THEN
    CREATE INDEX idx_user_settings_share_token ON user_settings (share_token) WHERE share_token IS NOT NULL;
  END IF;
END $$;
