-- Task 13: Add ИКПУ (МХИК) code column to products.
-- Stores the 17-digit tax classification code from tasnif.soliq.uz.
-- Populated via the IKPU lookup UI, never by marketplace sync.

ALTER TABLE products ADD COLUMN IF NOT EXISTS ikpu_code text;
