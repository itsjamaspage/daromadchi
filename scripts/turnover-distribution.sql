-- ─────────────────────────────────────────────────────────────────────────────
-- Daromadchi — trailing-30-day NET turnover distribution per seller account.
--
-- Run BEFORE Branch 1 (feat/turnover-tier-compute) to check whether real sellers
-- cluster where the proposed pricing bands land. Read-only: SELECT only.
--
--   psql "$DATABASE_URL" -f scripts/turnover-distribution.sql
--
-- Corrected against the real schema (lib/db/schema.ts). Differences from the
-- original draft, each of which changed the result:
--   * orders has NO account_id — it has shop_id. Seller identity is
--     orders → shops.user_id → users.id, so the join is mandatory.
--   * orders.revenue is NUMERIC NULL-able → COALESCE before summing.
--   * order_status enum is pending|confirmed|delivered|cancelled|returned.
--     Both 'cancelled' AND 'returned' are excluded here. NOTE: getKpis()
--     (lib/db/kpis.ts:28) excludes ONLY 'cancelled', so this query is
--     deliberately stricter than the dashboard's revenue figure.
--   * There is NO unique constraint on (shop_id, order_id_external) —
--     migration 018 creates a PLAIN index, and both sync paths do
--     select-then-insert. Duplicate orders are therefore possible, so this
--     dedupes defensively.
--   * DEMO shops are excluded, matching getShopIds() (lib/api/auth.ts:18).
--   * Users are LEFT JOINed so accounts with ZERO orders still appear. The
--     original inner-join grouping dropped them — which would have hidden the
--     dead-account population that Branch 6's freeze job targets.
-- ─────────────────────────────────────────────────────────────────────────────

-- Deduped, in-window, earning orders. One row per (shop, external order id);
-- rows with a NULL external id fall back to their own primary key so they are
-- never collapsed into each other.
WITH deduped_orders AS (
    SELECT DISTINCT ON (o.shop_id, COALESCE(o.order_id_external, o.id::text))
           o.id,
           o.shop_id,
           o.revenue
    FROM orders o
    WHERE o.ordered_at >= NOW() - INTERVAL '30 days'
      AND o.status NOT IN ('cancelled', 'returned')
    ORDER BY o.shop_id,
             COALESCE(o.order_id_external, o.id::text),
             o.ordered_at DESC,
             o.id DESC
),

account_turnover AS (
    SELECT u.id AS user_id,
           COALESCE(SUM(COALESCE(d.revenue, 0)::numeric), 0) AS turnover_30d
    FROM users u
    -- Mirrors getShopIds(): every shop the user owns, DEMO shops excluded.
    LEFT JOIN shops s
           ON s.user_id = u.id
          AND (s.shop_id_external IS NULL OR s.shop_id_external <> 'DEMO')
    LEFT JOIN deduped_orders d
           ON d.shop_id = s.id
    GROUP BY u.id
)

-- ── 1. Band distribution ────────────────────────────────────────────────────
-- Bands are the FINAL agreed ladder, with the 12–30 mln slice broken out so the
-- on-ramp-tier question is still answerable from the same run.
SELECT
    CASE
        WHEN turnover_30d =  0          THEN '0. No sales        (0)'
        WHEN turnover_30d <  12000000   THEN '1. Free            (0 – 12 mln)'
        WHEN turnover_30d <  30000000   THEN '2. Pro / on-ramp?  (12 – 30 mln)'
        WHEN turnover_30d <  90000000   THEN '3. Pro             (30 – 90 mln)'
        WHEN turnover_30d < 120000000   THEN '4. Pro+            (90 – 120 mln)'
        WHEN turnover_30d < 162000000   THEN '5. Biznes          (120 – 162 mln)'
        WHEN turnover_30d < 180000000   THEN '6. Biznes/popup    (162 – 180 mln)'
        ELSE                                 '7. Enterprise      (180 mln+)'
    END AS band,
    COUNT(*)                                            AS sellers,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1)  AS pct_of_sellers,
    TO_CHAR(MIN(turnover_30d), 'FM999,999,999,999')     AS band_min,
    TO_CHAR(MAX(turnover_30d), 'FM999,999,999,999')     AS band_max
FROM account_turnover
GROUP BY band
ORDER BY band;

-- ── 2. Percentiles ──────────────────────────────────────────────────────────
-- With a small seller base the banded counts above are noisy; percentiles over
-- the SELLING accounts show the real shape and are the better input for moving
-- a threshold.
-- The CTE is repeated verbatim: a WITH clause is scoped to ONE statement, so
-- query 1's definition is not visible here.
WITH deduped_orders AS (
    SELECT DISTINCT ON (o.shop_id, COALESCE(o.order_id_external, o.id::text))
           o.id,
           o.shop_id,
           o.revenue
    FROM orders o
    WHERE o.ordered_at >= NOW() - INTERVAL '30 days'
      AND o.status NOT IN ('cancelled', 'returned')
    ORDER BY o.shop_id,
             COALESCE(o.order_id_external, o.id::text),
             o.ordered_at DESC,
             o.id DESC
),

account_turnover AS (
    SELECT u.id AS user_id,
           COALESCE(SUM(COALESCE(d.revenue, 0)::numeric), 0) AS turnover_30d
    FROM users u
    -- Mirrors getShopIds(): every shop the user owns, DEMO shops excluded.
    LEFT JOIN shops s
           ON s.user_id = u.id
          AND (s.shop_id_external IS NULL OR s.shop_id_external <> 'DEMO')
    LEFT JOIN deduped_orders d
           ON d.shop_id = s.id
    GROUP BY u.id
)
SELECT
    COUNT(*)                                                                     AS selling_accounts,
    TO_CHAR(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY turnover_30d), 'FM999,999,999,999') AS p25,
    TO_CHAR(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY turnover_30d), 'FM999,999,999,999') AS median,
    TO_CHAR(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY turnover_30d), 'FM999,999,999,999') AS p75,
    TO_CHAR(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY turnover_30d), 'FM999,999,999,999') AS p90,
    TO_CHAR(MAX(turnover_30d),                                          'FM999,999,999,999') AS max
FROM account_turnover
WHERE turnover_30d > 0;

-- ── 3. Duplicate-order check (validates assumption #3) ───────────────────────
-- Any row returned here means order sync HAS double-inserted, so the dedupe in
-- query 1 is load-bearing and computeTurnover30d() must dedupe too. Empty
-- result = no duplicates present today (still unconstrained at the DB level).
SELECT o.shop_id,
       o.order_id_external,
       COUNT(*) AS copies
FROM orders o
WHERE o.order_id_external IS NOT NULL
  AND o.ordered_at >= NOW() - INTERVAL '90 days'
GROUP BY o.shop_id, o.order_id_external
HAVING COUNT(*) > 1
ORDER BY copies DESC
LIMIT 20;
