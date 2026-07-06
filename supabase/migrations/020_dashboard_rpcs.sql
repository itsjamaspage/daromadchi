-- Dashboard RPCs to replace multi-query JS aggregation with single server-side calls.
-- Each RPC replicates the EXACT behavior of the corresponding TypeScript function,
-- including known inconsistencies (e.g. getCategoryRevenue does not exclude cancelled orders).

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. get_dashboard_kpis
--    Replaces: lib/db/kpis.ts _fetchKpis()
--    Returns: current-period totals, previous-period totals, stock total
--    Note: previous-period boundary uses strict < on upper bound (matches JS .lt())
-- ═══════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS get_dashboard_kpis(uuid[], timestamptz, timestamptz, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION get_dashboard_kpis(
  p_shop_ids       uuid[],
  p_since          timestamptz DEFAULT NULL,
  p_until          timestamptz DEFAULT NULL,
  p_prev_since     timestamptz DEFAULT NULL,
  p_prev_until     timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_revenue    numeric,
  total_profit     numeric,
  total_orders     bigint,
  total_stock      bigint,
  prev_revenue     numeric,
  prev_profit      numeric,
  prev_orders      bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    -- Current period
    COALESCE(SUM(
      CASE WHEN (p_since IS NULL OR o.ordered_at >= p_since)
            AND (p_until IS NULL OR o.ordered_at <= p_until)
      THEN COALESCE(o.revenue, 0)
      ELSE 0 END
    ), 0) AS total_revenue,

    COALESCE(SUM(
      CASE WHEN (p_since IS NULL OR o.ordered_at >= p_since)
            AND (p_until IS NULL OR o.ordered_at <= p_until)
      THEN COALESCE(o.revenue, 0) - COALESCE(o.marketplace_fee, 0) - COALESCE(o.delivery_cost, 0)
      ELSE 0 END
    ), 0) AS total_profit,

    COALESCE(SUM(
      CASE WHEN (p_since IS NULL OR o.ordered_at >= p_since)
            AND (p_until IS NULL OR o.ordered_at <= p_until)
      THEN 1
      ELSE 0 END
    )::bigint, 0) AS total_orders,

    -- Stock (computed separately below via subquery)
    (SELECT COALESCE(SUM(COALESCE(p.stock_quantity, 0)), 0)
     FROM products p
     WHERE p.shop_id = ANY(p_shop_ids)
    ) AS total_stock,

    -- Previous period (strict < on upper bound, matching JS .lt())
    COALESCE(SUM(
      CASE WHEN p_prev_since IS NOT NULL
            AND o.ordered_at >= p_prev_since
            AND o.ordered_at < p_prev_until
      THEN COALESCE(o.revenue, 0)
      ELSE 0 END
    ), 0) AS prev_revenue,

    COALESCE(SUM(
      CASE WHEN p_prev_since IS NOT NULL
            AND o.ordered_at >= p_prev_since
            AND o.ordered_at < p_prev_until
      THEN COALESCE(o.revenue, 0) - COALESCE(o.marketplace_fee, 0) - COALESCE(o.delivery_cost, 0)
      ELSE 0 END
    ), 0) AS prev_profit,

    COALESCE(SUM(
      CASE WHEN p_prev_since IS NOT NULL
            AND o.ordered_at >= p_prev_since
            AND o.ordered_at < p_prev_until
      THEN 1
      ELSE 0 END
    )::bigint, 0) AS prev_orders

  FROM orders o
  WHERE o.shop_id = ANY(p_shop_ids)
    AND o.status != 'cancelled';
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. get_daily_revenue
--    Replaces: lib/db/revenue.ts _fetchRevenue()
--    Returns: date-bucketed revenue + order count
--    Date bucketing: ordered_at cast to date (UTC), matching JS .slice(0,10)
--    Label formatting is done in the app layer, NOT here.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS get_daily_revenue(uuid[], timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION get_daily_revenue(
  p_shop_ids  uuid[],
  p_since     timestamptz,
  p_until     timestamptz DEFAULT NULL
)
RETURNS TABLE (
  day           date,
  revenue       numeric,
  order_count   bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    (o.ordered_at AT TIME ZONE 'UTC')::date AS day,
    COALESCE(SUM(COALESCE(o.revenue, 0)), 0) AS revenue,
    COUNT(*) AS order_count
  FROM orders o
  WHERE o.shop_id = ANY(p_shop_ids)
    AND o.status != 'cancelled'
    AND o.ordered_at >= p_since
    AND (p_until IS NULL OR o.ordered_at <= p_until)
  GROUP BY (o.ordered_at AT TIME ZONE 'UTC')::date
  ORDER BY day;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. get_category_revenue
--    Replaces: lib/db/products.ts _fetchCategoryRevenue()
--    Returns: per-category revenue, profit, percent
--    NOTE: does NOT exclude cancelled orders — matches current JS behavior.
--    Default category for NULL = 'Boshqa' (Uzbek for "Other").
--    Revenue and profit are rounded to integers (Math.round in JS).
-- ═══════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS get_category_revenue(uuid[], timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION get_category_revenue(
  p_shop_ids  uuid[],
  p_since     timestamptz DEFAULT NULL,
  p_until     timestamptz DEFAULT NULL
)
RETURNS TABLE (
  name      text,
  revenue   numeric,
  profit    numeric,
  percent   double precision
)
LANGUAGE sql STABLE
AS $$
  WITH qualifying_orders AS (
    SELECT o.id
    FROM orders o
    WHERE o.shop_id = ANY(p_shop_ids)
      AND (p_since IS NULL OR o.ordered_at >= p_since)
      AND (p_until IS NULL OR o.ordered_at <= p_until)
  ),

  item_data AS (
    SELECT
      COALESCE(p.category, 'Boshqa') AS cat,
      COALESCE(oi.price_per_unit, 0) * COALESCE(oi.quantity, 0) AS item_revenue,
      COALESCE(oi.cost_per_unit, 0) * COALESCE(oi.quantity, 0) AS item_cost
    FROM order_items oi
    JOIN qualifying_orders qo ON qo.id = oi.order_id
    LEFT JOIN products p ON p.id = oi.product_id
  ),

  category_totals AS (
    SELECT
      cat AS name,
      ROUND(SUM(item_revenue)) AS revenue,
      ROUND(SUM(item_revenue - item_cost)) AS profit
    FROM item_data
    GROUP BY cat
  ),

  grand_total AS (
    SELECT COALESCE(SUM(revenue), 0) AS total FROM category_totals
  )

  SELECT
    ct.name,
    ct.revenue,
    ct.profit,
    CASE WHEN gt.total > 0
      THEN (ct.revenue::double precision / gt.total::double precision) * 100.0
      ELSE 0.0
    END AS percent
  FROM category_totals ct
  CROSS JOIN grand_total gt
  ORDER BY ct.revenue DESC;
$$;
