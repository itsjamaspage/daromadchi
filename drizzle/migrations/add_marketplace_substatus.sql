-- Persist the marketplace-level substatus (e.g. Yandex PICKUP_EXPIRED) so the
-- sync can reclassify невыкуп CANCELLED orders as 'returned'.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS marketplace_substatus TEXT;
