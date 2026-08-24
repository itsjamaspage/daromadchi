-- Make products' timestamps mean something.
--
-- Two clocks, one cause. Investigating "is stock actually updating?" (#311,
-- #313) was expensive for a reason that had nothing to do with stock:
--
--   • products.updated_at is defaultNow() with NO trigger, and NOT ONE of the
--     16 db.update(products) call sites sets it. It is structurally incapable
--     of advancing on an update. "Newest updated_at is Aug 17" was read as
--     "stock is frozen"; it actually meant "no product row inserted since Aug
--     17" and said nothing at all about stock. A column that looks like an
--     answer and isn't is worse than no column.
--
--   • The stock refresh computes how many rows it changed, logs it, and throws
--     it away. Nothing in the database records when a SKU's stock last moved,
--     so the question can only be answered by watching a live tick.
--
-- A trigger rather than 16 edits: the 17th writer cannot forget it, and it
-- covers paths that never go through the app at all (a manual SQL fix, a
-- future backfill). #311 §5.1 called this out as the better of the two.
CREATE OR REPLACE FUNCTION products_stamp_timestamps() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  -- IS DISTINCT FROM, not <>: stock_quantity is NOT NULL today, but a NULL on
  -- either side would make <> return NULL and silently skip the stamp.
  IF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
    NEW.stock_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_changed_at timestamptz;

-- Idempotent: every registered migration re-runs on every deploy, and CREATE
-- TRIGGER has no IF NOT EXISTS on the Postgres versions we target.
DROP TRIGGER IF EXISTS products_stamp_timestamps_trg ON products;
CREATE TRIGGER products_stamp_timestamps_trg
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION products_stamp_timestamps();

-- Backfilled to NULL, deliberately. Every existing row reads as "stock has
-- never been observed to change", which is the honest answer: we genuinely do
-- not know, and no stored data can tell us. Guessing a value here — copying
-- updated_at, say — would recreate exactly the failure this migration exists
-- to end, a timestamp that looks authoritative and isn't. Rows fill in as
-- their stock actually moves.
--
-- NOT for display. It answers one operational question: "is this SKU's stock
-- moving at all?" A NULL that stays NULL across several refresh cycles while
-- the marketplace shows movement is a real signal, and until now there was no
-- way to see it.
CREATE INDEX IF NOT EXISTS products_stock_changed_at_idx
  ON products (shop_id, stock_changed_at);
