-- Cross-marketplace leftover tracking
-- Products are auto-grouped across marketplaces by normalized seller article (SKU).
-- This table stores per-group user settings: the physical stock baseline
-- ("I bought 10 of these") and a per-group low-stock alert threshold.
-- All marketplace data stays read-only; leftovers are computed inside Daromadchi.

CREATE TABLE IF NOT EXISTS public.product_links (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  match_key            text NOT NULL,
  total_physical_stock integer,
  baseline_at          timestamptz,
  stock_threshold      integer,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_links_user_key_unique UNIQUE (user_id, match_key)
);

-- No RLS: production runs plain Postgres (no Supabase auth schema); this table
-- is only accessed through the app's server-side queries, always scoped by user_id.
CREATE INDEX IF NOT EXISTS idx_product_links_user_id ON public.product_links (user_id);
