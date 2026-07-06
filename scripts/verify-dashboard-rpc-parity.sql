-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  DASHBOARD RPC PARITY VERIFICATION                                         ║
-- ║  Run this in Supabase SQL Editor to verify RPCs match old JS aggregation.  ║
-- ║  RPCs under test: get_dashboard_kpis, get_daily_revenue, get_category_revenue ║
-- ║  User: 4d1182a9-4785-4a83-a492-433ff081b1ae                                ║
-- ║  DEMO shops excluded (matches production getUserShops filter)               ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 0: SHOP ID INVENTORY
-- Shows which shops exist for this user, by marketplace.
-- If any marketplace group is empty, those test rows will show NULL = NULL (PASS).
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT marketplace, COUNT(*) AS shop_count, ARRAY_AGG(id) AS shop_ids
FROM shops
WHERE user_id = '4d1182a9-4785-4a83-a492-433ff081b1ae'
  AND shop_id_external != 'DEMO'
GROUP BY marketplace
ORDER BY marketplace;


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: VERIFY get_dashboard_kpis
--
-- OLD LOGIC (from pre-PR-42 kpis.ts):
--   Current period: orders WHERE status != 'cancelled' AND ordered_at >= since [AND ordered_at <= until]
--     revenue = SUM(COALESCE(revenue, 0))
--     profit  = SUM(COALESCE(revenue,0) - COALESCE(marketplace_fee,0) - COALESCE(delivery_cost,0))
--     orders  = COUNT(*)
--   Previous period: same but ordered_at >= prev_since AND ordered_at < prev_until (strict <)
--   Stock: SUM(stock_quantity) from products for all shop_ids
--
-- Tests: days=30 × {all, uzum, yandex_market, wildberries}
--        from/to range × {all, uzum, yandex_market, wildberries}
--
-- Output: Only rows where OLD != NEW (empty = all pass)
-- ═══════════════════════════════════════════════════════════════════════════════

WITH shop_groups AS (
  SELECT
    s.marketplace AS mkt_filter,
    ARRAY_AGG(s.id) AS ids
  FROM shops s
  WHERE s.user_id = '4d1182a9-4785-4a83-a492-433ff081b1ae'
    AND s.shop_id_external != 'DEMO'
  GROUP BY s.marketplace

  UNION ALL

  SELECT
    'all'::text AS mkt_filter,
    ARRAY_AGG(s.id) AS ids
  FROM shops s
  WHERE s.user_id = '4d1182a9-4785-4a83-a492-433ff081b1ae'
    AND s.shop_id_external != 'DEMO'
),

time_modes AS (
  -- Mode A: days=30 → since = now - 29 days, until = NULL, prev_since = since - 30 days, prev_until = since
  SELECT
    'days30'::text AS time_mode,
    (now() - interval '29 days') AS p_since,
    NULL::timestamptz AS p_until,
    (now() - interval '59 days') AS p_prev_since,
    (now() - interval '29 days') AS p_prev_until

  UNION ALL

  -- Mode B: from=2026-01-01 to=2026-03-31
  --   since = 2026-01-01T00:00:00Z
  --   until = 2026-03-31T23:59:59.999Z
  --   span  = until - since
  --   prevTo = since - 1ms = 2025-12-31T23:59:59.999Z
  --   prevFrom = prevTo - span
  SELECT
    'range'::text,
    '2026-01-01T00:00:00Z'::timestamptz,
    '2026-03-31T23:59:59.999Z'::timestamptz,
    ('2025-12-31T23:59:59.999Z'::timestamptz) - ('2026-03-31T23:59:59.999Z'::timestamptz - '2026-01-01T00:00:00Z'::timestamptz),
    '2025-12-31T23:59:59.999Z'::timestamptz
),

test_combos AS (
  SELECT sg.mkt_filter, sg.ids, tm.*
  FROM shop_groups sg
  CROSS JOIN time_modes tm
),

-- OLD LOGIC: pure SQL replicating pre-PR-42 JS aggregation
old_logic AS (
  SELECT
    tc.mkt_filter,
    tc.time_mode,

    -- Current period revenue
    COALESCE(SUM(
      CASE WHEN o.ordered_at >= tc.p_since
            AND (tc.p_until IS NULL OR o.ordered_at <= tc.p_until)
      THEN COALESCE(o.revenue, 0) ELSE 0 END
    ), 0) AS total_revenue,

    -- Current period profit
    COALESCE(SUM(
      CASE WHEN o.ordered_at >= tc.p_since
            AND (tc.p_until IS NULL OR o.ordered_at <= tc.p_until)
      THEN COALESCE(o.revenue, 0) - COALESCE(o.marketplace_fee, 0) - COALESCE(o.delivery_cost, 0)
      ELSE 0 END
    ), 0) AS total_profit,

    -- Current period order count
    COALESCE(SUM(
      CASE WHEN o.ordered_at >= tc.p_since
            AND (tc.p_until IS NULL OR o.ordered_at <= tc.p_until)
      THEN 1 ELSE 0 END
    )::bigint, 0) AS total_orders,

    -- Stock
    (SELECT COALESCE(SUM(COALESCE(p.stock_quantity, 0)), 0)
     FROM products p WHERE p.shop_id = ANY(tc.ids)
    ) AS total_stock,

    -- Previous period revenue (strict < on upper bound)
    COALESCE(SUM(
      CASE WHEN tc.p_prev_since IS NOT NULL
            AND o.ordered_at >= tc.p_prev_since
            AND o.ordered_at < tc.p_prev_until
      THEN COALESCE(o.revenue, 0) ELSE 0 END
    ), 0) AS prev_revenue,

    -- Previous period profit
    COALESCE(SUM(
      CASE WHEN tc.p_prev_since IS NOT NULL
            AND o.ordered_at >= tc.p_prev_since
            AND o.ordered_at < tc.p_prev_until
      THEN COALESCE(o.revenue, 0) - COALESCE(o.marketplace_fee, 0) - COALESCE(o.delivery_cost, 0)
      ELSE 0 END
    ), 0) AS prev_profit,

    -- Previous period order count
    COALESCE(SUM(
      CASE WHEN tc.p_prev_since IS NOT NULL
            AND o.ordered_at >= tc.p_prev_since
            AND o.ordered_at < tc.p_prev_until
      THEN 1 ELSE 0 END
    )::bigint, 0) AS prev_orders

  FROM test_combos tc
  LEFT JOIN orders o ON o.shop_id = ANY(tc.ids) AND o.status != 'cancelled'
  GROUP BY tc.mkt_filter, tc.time_mode, tc.ids
),

-- NEW LOGIC: call the RPC
new_logic AS (
  SELECT
    tc.mkt_filter,
    tc.time_mode,
    rpc.*
  FROM test_combos tc
  CROSS JOIN LATERAL (
    SELECT *
    FROM get_dashboard_kpis(tc.ids, tc.p_since, tc.p_until, tc.p_prev_since, tc.p_prev_until)
  ) rpc
)

-- COMPARE: show only mismatches
SELECT
  'get_dashboard_kpis' AS rpc,
  o.mkt_filter,
  o.time_mode,
  'OLD' AS source,
  o.total_revenue, o.total_profit, o.total_orders, o.total_stock,
  o.prev_revenue, o.prev_profit, o.prev_orders
FROM old_logic o
WHERE NOT EXISTS (
  SELECT 1 FROM new_logic n
  WHERE n.mkt_filter = o.mkt_filter
    AND n.time_mode = o.time_mode
    AND n.total_revenue = o.total_revenue
    AND n.total_profit = o.total_profit
    AND n.total_orders = o.total_orders
    AND n.total_stock = o.total_stock
    AND n.prev_revenue = o.prev_revenue
    AND n.prev_profit = o.prev_profit
    AND n.prev_orders = o.prev_orders
)

UNION ALL

SELECT
  'get_dashboard_kpis',
  n.mkt_filter,
  n.time_mode,
  'NEW',
  n.total_revenue, n.total_profit, n.total_orders, n.total_stock,
  n.prev_revenue, n.prev_profit, n.prev_orders
FROM new_logic n
WHERE NOT EXISTS (
  SELECT 1 FROM old_logic o
  WHERE o.mkt_filter = n.mkt_filter
    AND o.time_mode = n.time_mode
    AND o.total_revenue = n.total_revenue
    AND o.total_profit = n.total_profit
    AND o.total_orders = n.total_orders
    AND o.total_stock = n.total_stock
    AND o.prev_revenue = n.prev_revenue
    AND o.prev_profit = n.prev_profit
    AND o.prev_orders = n.prev_orders
)

ORDER BY mkt_filter, time_mode, source;


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: VERIFY get_daily_revenue
--
-- OLD LOGIC (from pre-PR-42 revenue.ts):
--   Query: orders WHERE shop_id IN (...) AND status != 'cancelled'
--          AND ordered_at >= since [AND ordered_at <= until]
--   Group by: ordered_at ISO string sliced to first 10 chars = UTC date
--     → SQL equivalent: (ordered_at AT TIME ZONE 'UTC')::date
--   revenue = SUM(COALESCE(revenue, 0))
--   order_count = COUNT(*)
--
-- Tests: days=30 × {all, uzum, yandex_market, wildberries}
--        from/to range × {all, uzum, yandex_market, wildberries}
--
-- Output: Only rows where OLD != NEW (empty = all pass)
-- ═══════════════════════════════════════════════════════════════════════════════

WITH shop_groups AS (
  SELECT s.marketplace AS mkt_filter, ARRAY_AGG(s.id) AS ids
  FROM shops s
  WHERE s.user_id = '4d1182a9-4785-4a83-a492-433ff081b1ae'
    AND s.shop_id_external != 'DEMO'
  GROUP BY s.marketplace

  UNION ALL

  SELECT 'all'::text, ARRAY_AGG(s.id)
  FROM shops s
  WHERE s.user_id = '4d1182a9-4785-4a83-a492-433ff081b1ae'
    AND s.shop_id_external != 'DEMO'
),

time_modes_rev AS (
  -- days=30: since = now - 29 days, until = NULL
  SELECT
    'days30'::text AS time_mode,
    (now() - interval '29 days') AS p_since,
    NULL::timestamptz AS p_until

  UNION ALL

  -- from/to range
  SELECT
    'range'::text,
    '2026-01-01T00:00:00Z'::timestamptz,
    '2026-03-31T23:59:59.999Z'::timestamptz
),

combos_rev AS (
  SELECT sg.mkt_filter, sg.ids, tm.*
  FROM shop_groups sg
  CROSS JOIN time_modes_rev tm
),

old_revenue AS (
  SELECT
    tc.mkt_filter,
    tc.time_mode,
    (o.ordered_at AT TIME ZONE 'UTC')::date AS day,
    COALESCE(SUM(COALESCE(o.revenue, 0)), 0) AS revenue,
    COUNT(*) AS order_count
  FROM combos_rev tc
  JOIN orders o ON o.shop_id = ANY(tc.ids)
    AND o.status != 'cancelled'
    AND o.ordered_at >= tc.p_since
    AND (tc.p_until IS NULL OR o.ordered_at <= tc.p_until)
  GROUP BY tc.mkt_filter, tc.time_mode, (o.ordered_at AT TIME ZONE 'UTC')::date
),

new_revenue AS (
  SELECT
    tc.mkt_filter,
    tc.time_mode,
    rpc.day,
    rpc.revenue,
    rpc.order_count
  FROM combos_rev tc
  CROSS JOIN LATERAL (
    SELECT * FROM get_daily_revenue(tc.ids, tc.p_since, tc.p_until)
  ) rpc
)

-- COMPARE
SELECT
  'get_daily_revenue' AS rpc,
  o.mkt_filter,
  o.time_mode,
  o.day,
  'OLD' AS source,
  o.revenue, o.order_count
FROM old_revenue o
WHERE NOT EXISTS (
  SELECT 1 FROM new_revenue n
  WHERE n.mkt_filter = o.mkt_filter
    AND n.time_mode = o.time_mode
    AND n.day = o.day
    AND n.revenue = o.revenue
    AND n.order_count = o.order_count
)

UNION ALL

SELECT
  'get_daily_revenue',
  n.mkt_filter,
  n.time_mode,
  n.day,
  'NEW',
  n.revenue, n.order_count
FROM new_revenue n
WHERE NOT EXISTS (
  SELECT 1 FROM old_revenue o
  WHERE o.mkt_filter = n.mkt_filter
    AND o.time_mode = n.time_mode
    AND o.day = n.day
    AND o.revenue = n.revenue
    AND o.order_count = n.order_count
)

ORDER BY mkt_filter, time_mode, day, source;


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: VERIFY get_category_revenue
--
-- OLD LOGIC (from pre-PR-42 products.ts _fetchCategoryRevenue):
--   1. Get order IDs: orders WHERE shop_id IN (...) AND ordered_at >= since [AND ordered_at <= until]
--      NOTE: Does NOT exclude cancelled orders!
--   2. Get order_items for those orders, LEFT JOIN products for category
--   3. Per item: item_revenue = price_per_unit * quantity, item_cost = cost_per_unit * quantity
--   4. Group by COALESCE(category, 'Boshqa')
--   5. revenue = Math.round(SUM(item_revenue)), profit = Math.round(SUM(item_revenue - item_cost))
--   6. percent = (revenue / grand_total) * 100
--
-- ⚠ POTENTIAL DIFFERENCE: JS Math.round(0.5) = 1, PG ROUND(0.5) = 0 (banker's rounding)
--   This can cause ±1 unit differences. The comparison below flags exact mismatches;
--   if you see differences of exactly 1 in revenue/profit, banker's rounding is the cause.
--
-- Tests: days=30 × {all, uzum, yandex_market, wildberries}
--        from/to range × {all, uzum, yandex_market, wildberries}
--
-- Output: Only rows where OLD != NEW (empty = all pass)
-- ═══════════════════════════════════════════════════════════════════════════════

WITH shop_groups AS (
  SELECT s.marketplace AS mkt_filter, ARRAY_AGG(s.id) AS ids
  FROM shops s
  WHERE s.user_id = '4d1182a9-4785-4a83-a492-433ff081b1ae'
    AND s.shop_id_external != 'DEMO'
  GROUP BY s.marketplace

  UNION ALL

  SELECT 'all'::text, ARRAY_AGG(s.id)
  FROM shops s
  WHERE s.user_id = '4d1182a9-4785-4a83-a492-433ff081b1ae'
    AND s.shop_id_external != 'DEMO'
),

time_modes_cat AS (
  -- days=30: since = now - 29 days, until = NULL
  -- (products.ts: d.setDate(d.getDate() - days + 1) → now - 29 days)
  SELECT
    'days30'::text AS time_mode,
    (now() - interval '29 days') AS p_since,
    NULL::timestamptz AS p_until

  UNION ALL

  -- from/to range
  SELECT
    'range'::text,
    '2026-01-01T00:00:00Z'::timestamptz,
    '2026-03-31T23:59:59.999Z'::timestamptz
),

combos_cat AS (
  SELECT sg.mkt_filter, sg.ids, tm.*
  FROM shop_groups sg
  CROSS JOIN time_modes_cat tm
),

-- OLD LOGIC: replicate JS aggregation as SQL
old_cat_raw AS (
  SELECT
    tc.mkt_filter,
    tc.time_mode,
    COALESCE(p.category, 'Boshqa') AS name,
    ROUND(SUM(COALESCE(oi.price_per_unit, 0) * COALESCE(oi.quantity, 0))) AS revenue,
    ROUND(SUM(
      (COALESCE(oi.price_per_unit, 0) * COALESCE(oi.quantity, 0))
      - (COALESCE(oi.cost_per_unit, 0) * COALESCE(oi.quantity, 0))
    )) AS profit
  FROM combos_cat tc
  JOIN orders o ON o.shop_id = ANY(tc.ids)
    AND (tc.p_since IS NULL OR o.ordered_at >= tc.p_since)
    AND (tc.p_until IS NULL OR o.ordered_at <= tc.p_until)
  JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN products p ON p.id = oi.product_id
  GROUP BY tc.mkt_filter, tc.time_mode, COALESCE(p.category, 'Boshqa')
),

old_cat_totals AS (
  SELECT mkt_filter, time_mode, COALESCE(SUM(revenue), 0) AS grand_total
  FROM old_cat_raw
  GROUP BY mkt_filter, time_mode
),

old_category AS (
  SELECT
    r.mkt_filter,
    r.time_mode,
    r.name,
    r.revenue,
    r.profit,
    CASE WHEN t.grand_total > 0
      THEN (r.revenue::double precision / t.grand_total::double precision) * 100.0
      ELSE 0.0
    END AS percent
  FROM old_cat_raw r
  JOIN old_cat_totals t ON t.mkt_filter = r.mkt_filter AND t.time_mode = r.time_mode
),

new_category AS (
  SELECT
    tc.mkt_filter,
    tc.time_mode,
    rpc.name,
    rpc.revenue,
    rpc.profit,
    rpc.percent
  FROM combos_cat tc
  CROSS JOIN LATERAL (
    SELECT * FROM get_category_revenue(tc.ids, tc.p_since, tc.p_until)
  ) rpc
)

-- COMPARE (tolerance: exact match on revenue/profit, 0.001 tolerance on percent for float rounding)
SELECT
  'get_category_revenue' AS rpc,
  o.mkt_filter,
  o.time_mode,
  o.name AS category,
  'OLD' AS source,
  o.revenue, o.profit, ROUND(o.percent::numeric, 4) AS percent
FROM old_category o
WHERE NOT EXISTS (
  SELECT 1 FROM new_category n
  WHERE n.mkt_filter = o.mkt_filter
    AND n.time_mode = o.time_mode
    AND n.name = o.name
    AND n.revenue = o.revenue
    AND n.profit = o.profit
    AND ABS(n.percent - o.percent) < 0.001
)

UNION ALL

SELECT
  'get_category_revenue',
  n.mkt_filter,
  n.time_mode,
  n.name,
  'NEW',
  n.revenue, n.profit, ROUND(n.percent::numeric, 4)
FROM new_category n
WHERE NOT EXISTS (
  SELECT 1 FROM old_category o
  WHERE o.mkt_filter = n.mkt_filter
    AND o.time_mode = n.time_mode
    AND o.name = n.name
    AND o.revenue = n.revenue
    AND o.profit = n.profit
    AND ABS(o.percent - n.percent) < 0.001
)

ORDER BY mkt_filter, time_mode, category, source;


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: SUMMARY — Quick pass/fail count
-- Run this AFTER the 3 steps above. If all returned 0 rows, everything passes.
-- This query gives you a single-glance answer.
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 'PARITY CHECK COMPLETE' AS status,
  'If all 3 queries above returned 0 rows → ALL PASS' AS interpretation,
  'If any returned rows → those show OLD vs NEW mismatches to investigate' AS action;
