-- Manual cross-marketplace product grouping.
-- When the same physical product has different SKUs on different marketplaces,
-- users can merge them into one stock group by mapping source_key → target_key.
-- Idempotent so apply-sql-migrations.mjs can re-run it safely.
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
