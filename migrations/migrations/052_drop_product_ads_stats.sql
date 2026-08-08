-- Drop product_ads_stats: the standalone advertising/ads feature was removed.
-- Neither marketplace exposes ad-spend via API (Yandex boost-consolidated is
-- region-blocked; Uzum's seller API has no ads endpoint and its expenses feed
-- returned zero rows), so nothing writes this table and nothing reads it after
-- the ads feature, the P&L "Реклама" line, and the boost/expense syncs were
-- deleted. Idempotent: IF EXISTS makes it safe to re-run.
DROP TABLE IF EXISTS product_ads_stats;
