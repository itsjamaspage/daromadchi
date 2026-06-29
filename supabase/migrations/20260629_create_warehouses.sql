CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own warehouses" ON warehouses FOR ALL USING (user_id = auth.uid());
