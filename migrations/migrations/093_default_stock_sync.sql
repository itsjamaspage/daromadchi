-- Task 12: Remove read-only mode — all shops operate in edit (stock_sync) mode.
-- Flip any existing read_only shops to stock_sync and change the column default.

UPDATE shops SET api_mode = 'stock_sync' WHERE api_mode = 'read_only';

ALTER TABLE shops ALTER COLUMN api_mode SET DEFAULT 'stock_sync';
