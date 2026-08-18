-- 071: make order identity unique — (shop_id, order_id_external).
--
-- WHY: both sync paths resolve an order by (shop_id, order_id_external) with a
-- SELECT and then branch to INSERT or UPDATE (lib/uzum/sync.ts, lib/yandex/sync.ts).
-- Migration 018 backs that lookup with a PLAIN index, so nothing at the database
-- level stops two concurrent syncs for one shop from both missing and both
-- inserting. A duplicated order inflates trailing-30-day turnover, which now
-- decides a seller's billing tier — so this is a billing-correctness fix, not a
-- tidy-up.
--
-- NOT (marketplace, order_id_external): the shop already determines the
-- marketplace, and that key would collide across two different sellers on the
-- same marketplace, silently rejecting the second seller's genuine order.
--
-- PARTIAL on order_id_external IS NOT NULL: rows without an external id are
-- legitimate (manual/legacy) and must stay distinct from one another. Postgres
-- treats NULLs as distinct by default, but the predicate says so explicitly and
-- keeps the index smaller.
--
-- Idempotent: the collapse is a no-op once no duplicates remain, and the index
-- creation is IF NOT EXISTS. NOT created CONCURRENTLY on purpose — the runner
-- (scripts/apply-sql-migrations.mjs) sends each file as one multi-statement
-- query, which node-pg wraps in an implicit transaction, and CONCURRENTLY
-- cannot run inside one.

-- ── 1. Collapse any existing duplicates ─────────────────────────────────────
-- Keeps the RICHEST row: most order_items first (so a copy that carries line
-- items always beats a bare one), then the most recently ordered, then the
-- highest id as a deterministic final tie-break. order_items cascade from the
-- rows removed, which is why "most items" is the primary key of the ordering.
WITH ranked AS (
  SELECT o.id,
         ROW_NUMBER() OVER (
           PARTITION BY o.shop_id, o.order_id_external
           ORDER BY (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) DESC,
                    o.ordered_at DESC,
                    o.id DESC
         ) AS rn
    FROM orders o
   WHERE o.order_id_external IS NOT NULL
)
DELETE FROM orders
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ── 2. Enforce it from here on ──────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS orders_shop_order_external_unique
    ON orders (shop_id, order_id_external)
 WHERE order_id_external IS NOT NULL;
