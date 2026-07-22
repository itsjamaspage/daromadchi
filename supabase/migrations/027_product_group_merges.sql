-- Manual cross-marketplace product grouping.
-- When the same physical product has different SKUs on different marketplaces,
-- users can merge them into one stock group by mapping source_key → target_key.
CREATE TABLE product_group_merges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_key  text NOT NULL,
  target_key  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_group_merges_user_source UNIQUE (user_id, source_key)
);
CREATE INDEX idx_product_group_merges_user ON product_group_merges (user_id);
