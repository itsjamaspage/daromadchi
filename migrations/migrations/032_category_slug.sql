-- Add slug column to categories_canonical for stable taxonomy references
ALTER TABLE categories_canonical ADD COLUMN IF NOT EXISTS slug text;

-- Backfill existing rows with a placeholder (seed script will update these)
UPDATE categories_canonical SET slug = 'legacy_' || id WHERE slug IS NULL;

-- Make slug NOT NULL and unique after backfill
ALTER TABLE categories_canonical ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS categories_canonical_slug_idx ON categories_canonical (slug);
