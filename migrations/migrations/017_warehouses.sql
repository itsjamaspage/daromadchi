-- Shared warehouse stock system
-- Sellers can create named warehouses and assign shops to them.
-- Products with the same SKU sold from shops in the same warehouse share one inventory pool.

CREATE TABLE IF NOT EXISTS public.warehouses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own warehouses" ON public.warehouses
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_warehouses_user_id ON public.warehouses (user_id);
CREATE INDEX IF NOT EXISTS idx_shops_warehouse_id ON public.shops (warehouse_id);
