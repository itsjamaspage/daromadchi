ALTER TABLE orders ADD COLUMN IF NOT EXISTS penalty numeric DEFAULT '0';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS storage_fee numeric DEFAULT '0';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS additional_payment numeric DEFAULT '0';
