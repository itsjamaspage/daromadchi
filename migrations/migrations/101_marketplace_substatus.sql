-- Persist the marketplace-level substatus (e.g. Yandex PICKUP_EXPIRED) so the
-- sync can reclassify невыкуп CANCELLED orders as 'returned'.
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS marketplace_substatus TEXT;
