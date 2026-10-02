-- Products: track moderation state for pre-moderation / no-SKU products
-- so they appear in the "Все" tab with a badge instead of being force-archived.
ALTER TABLE products ADD COLUMN IF NOT EXISTS moderation_status text;
