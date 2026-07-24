-- Idempotent copy of the stock tracking tables, saved here per Task 1.
-- Actual application on deploy happens via scripts/apply-sql-migrations.mjs
-- which reads supabase/migrations/021_product_links.sql and
-- supabase/migrations/027_product_group_merges.sql. Keep those in sync
-- if you change anything here.

CREATE TABLE IF NOT EXISTS product_links (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_key            text NOT NULL,
  total_physical_stock integer,
  baseline_at          timestamptz,
  stock_threshold      integer,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_links_user_key_unique
  ON product_links (user_id, match_key);
CREATE INDEX IF NOT EXISTS idx_product_links_user_id
  ON product_links (user_id);

CREATE TABLE IF NOT EXISTS product_group_merges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_key  text NOT NULL,
  target_key  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_group_merges_user_source
  ON product_group_merges (user_id, source_key);
CREATE INDEX IF NOT EXISTS idx_product_group_merges_user
  ON product_group_merges (user_id);
