-- Track the fulfillment scheme of each order so FBS / FBO / DBS (and any future
-- types) can be distinguished in analytics and the UI. Nullable: existing rows
-- and any order whose type can't be determined stay NULL.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_type text;
