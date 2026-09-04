ALTER TABLE user_settings ADD COLUMN share_token TEXT UNIQUE;
CREATE INDEX idx_user_settings_share_token ON user_settings (share_token) WHERE share_token IS NOT NULL;
