-- Paginated products with warehouse-aware stock calculation.
-- Replicates the JS logic in lib/db/products.ts getProducts() but runs
-- entirely server-side, returning only the requested page.
--
-- Warehouse grouping: when two shops share a warehouse_id, products with
-- the same SKU draw from the same physical pool. available_stock for
-- shared products = stock_quantity - total_sold across all shops in that
-- warehouse+SKU group.

DROP FUNCTION IF EXISTS get_products_paginated(uuid, text, int, int);

CREATE OR REPLACE FUNCTION get_products_paginated(
  p_user_id    uuid,
  p_marketplace text DEFAULT NULL,
  p_offset     int  DEFAULT 0,
  p_limit      int  DEFAULT 50
)
RETURNS TABLE (
  id                     uuid,
  shop_id                uuid,
  sku                    text,
  title                  text,
  cost_price             numeric,
  selling_price          numeric,
  stock_quantity         int,
  category               text,
  marketplace_product_id text,
  updated_at             timestamptz,
  marketplace            text,
  warehouse_id           uuid,
  sold                   bigint,
  available_stock        int,
  is_shared              boolean,
  profit                 numeric,
  total_count            bigint
)
LANGUAGE sql STABLE
AS $$
  WITH user_shops AS (
    SELECT s.id, s.marketplace::text AS marketplace, s.warehouse_id
    FROM shops s
    WHERE s.user_id = p_user_id
      AND s.is_active = true
      AND s.shop_id_external IS DISTINCT FROM 'DEMO'
      AND (p_marketplace IS NULL OR s.marketplace::text = p_marketplace)
  ),

  -- All shops for this user (not marketplace-filtered) — needed for
  -- cross-marketplace warehouse grouping
  all_user_shops AS (
    SELECT s.id, s.warehouse_id
    FROM shops s
    WHERE s.user_id = p_user_id
      AND s.is_active = true
      AND s.shop_id_external IS DISTINCT FROM 'DEMO'
  ),

  -- Sold counts per product across all non-cancelled orders
  sold_counts AS (
    SELECT oi.product_id, COALESCE(SUM(oi.quantity), 0) AS qty_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.shop_id IN (SELECT id FROM all_user_shops)
      AND o.status != 'cancelled'
    GROUP BY oi.product_id
  ),

  -- Warehouse+SKU grouping: total sold and shop count per group
  -- across ALL user shops (not just filtered marketplace)
  warehouse_groups AS (
    SELECT
      sh.warehouse_id,
      p.sku,
      COALESCE(SUM(sc.qty_sold), 0) AS group_total_sold,
      COUNT(DISTINCT p.shop_id)     AS group_shop_count
    FROM products p
    JOIN all_user_shops sh ON sh.id = p.shop_id
    LEFT JOIN sold_counts sc ON sc.product_id = p.id
    WHERE p.sku IS NOT NULL
      AND sh.warehouse_id IS NOT NULL
    GROUP BY sh.warehouse_id, p.sku
  )

  SELECT
    p.id,
    p.shop_id,
    p.sku,
    p.title,
    p.cost_price,
    p.selling_price,
    p.stock_quantity,
    p.category,
    p.marketplace_product_id,
    p.updated_at,
    us.marketplace,
    us.warehouse_id,
    COALESCE(sc.qty_sold, 0)                         AS sold,
    CASE
      WHEN wg.group_shop_count > 1
        THEN GREATEST(0, p.stock_quantity - wg.group_total_sold::int)
      ELSE p.stock_quantity
    END                                               AS available_stock,
    COALESCE(wg.group_shop_count > 1, false)          AS is_shared,
    COALESCE(p.selling_price, 0) - COALESCE(p.cost_price, 0) AS profit,
    COUNT(*) OVER()                                   AS total_count
  FROM products p
  JOIN user_shops us ON us.id = p.shop_id
  LEFT JOIN sold_counts sc ON sc.product_id = p.id
  LEFT JOIN warehouse_groups wg
    ON wg.warehouse_id = us.warehouse_id
    AND wg.sku = p.sku
    AND p.sku IS NOT NULL
    AND us.warehouse_id IS NOT NULL
  ORDER BY p.title
  OFFSET p_offset
  LIMIT p_limit;
$$;
