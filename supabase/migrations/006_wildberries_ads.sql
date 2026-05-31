-- Migration 006: Wildberries marketplace + ad performance stats
-- Run this in the Supabase SQL Editor

-- Add wildberries to the marketplace enum
ALTER TYPE public.marketplace_type ADD VALUE IF NOT EXISTS 'wildberries';

-- Ad performance stats per SKU per day (any marketplace)
CREATE TABLE IF NOT EXISTS public.product_ads_stats (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid          NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  sku               text          NOT NULL,
  date              date          NOT NULL,
  impressions       bigint        NOT NULL DEFAULT 0,
  clicks            bigint        NOT NULL DEFAULT 0,
  spend             numeric(14,2) NOT NULL DEFAULT 0,
  orders_from_ads   integer       NOT NULL DEFAULT 0,
  revenue_from_ads  numeric(14,2) NOT NULL DEFAULT 0,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (shop_id, sku, date)
);

CREATE INDEX IF NOT EXISTS idx_ads_stats_shop_date
  ON public.product_ads_stats (shop_id, date DESC);

ALTER TABLE public.product_ads_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own ads stats"
  ON public.product_ads_stats FOR ALL
  USING (shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()));
