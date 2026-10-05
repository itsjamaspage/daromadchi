# Reconstruction Plan — Full Audit

**Date:** 2026-10-04
**Source of truth:** `docs/plans/reconstruction-plan.md`
**Method:** Code-level evidence from the live codebase (file:line), cross-referenced with merged PR history (#407–#606).

**Status legend:**
- **DONE-VERIFIED** = merged AND concrete proof it works (named below)
- **DONE-CLAIMED** = merged but never verified working in prod
- **PARTIAL** = some of it shipped; gaps listed
- **NOT FEASIBLE** = investigated, can't be done
- **TODO** = not started

---

## Task 1 — Move stock into Товары, Uzum-style

**Original goal (verbatim):**
> Relocate the standalone «Остатки» view into the Products («Товары») section. Lay out like the Uzum seller Products table: row = product photo + name + SKU/ID + status badge + «Остатки FBS, шт» column. Delete the standalone Остатки page/route and its nav entry.

**What shipped:** PR #431 (merged 2026-09-01).
- `app/dashboard/stocks/page.tsx`: redirects to `/dashboard/products` (not deleted — backward-compat redirect).
- `components/dashboard/ProductsTable.tsx:146-206`: `fbsUnits()` helper returns `available_stock` for FBS, `null` for FBO/FBY. `FbsCell` renders the value with inline editing.
- `components/dashboard/ProductsTable.tsx:822`: table header reads `d.fbsStockCol` → i18n "Остатки FBS, шт".
- `components/dashboard/Sidebar.tsx:23-34`: no stocks/Остатки entry in `storeNavItems`.
- No stock computation changes — `fbsUnits` reads the same `available_stock` field the old page used.

**Verification status:** DONE-CLAIMED.
Missing proof: owner has not confirmed parity (per-listing FBS numbers match what the old page showed). The plan note explicitly flags "⚠️ Owner to verify: Parity". No product photos were added (no photo data existed at time of build — addressed later by Task 7.5).

**Divergence:** None. Matches the ask. Product photos couldn't be added because sync didn't store images yet — that gap was explicitly documented and filled by Task 7.5.

**How to verify:** Open `/dashboard/products`. Confirm the "Остатки FBS, шт" column shows numbers. Compare a few products against the Uzum/Yandex seller cabinet stock values.

**Known gaps:** None remaining (photos added by Task 7.5).

---

## Task 2 — Category mapping

**Original goal (verbatim):**
> Daromadchi isn't picking up Russian categories. Investigate why, then map synonyms to one canonical category (e.g. «умные часы» + «смартчасы» → one). Foundation for filters (Task 8) and analytics (Task 5/6). Deliver a mapping mechanism, not a one-off patch.

**What shipped:** PR #432 (merged 2026-09-01), plus follow-up fixes in subsequent PRs.
- `lib/categories/resolve.ts` (61 lines): exports `resolveCanonical`, `resolveWithFallback`, `canonicalName`, `lookupTaxonomy`.
- `lib/categories/taxonomy.ts` (748 lines): 40 canonical categories with trilingual terms (ru/uz/en), raw marketplace examples.
- `lib/categories/matcher.ts` (87 lines): three-tier matching (exact → substring → token_set with Jaccard ≥ 0.5).
- Wired into: `lib/filters/category-helpers.ts` (ProductsTable), `lib/db/products.ts:444,492` (revenue/analytics category aggregation).
- Tests: `lib/categories/resolve.test.ts` (12 tests), `lib/categories/matcher.test.ts` (comprehensive tier tests).

**Verification status:** DONE-CLAIMED.
Missing proof: no evidence that synonym collapse actually works correctly in the live analytics donut chart. Tests prove the logic, but prod data hasn't been spot-checked.

**Divergence:** None. Exceeds the ask — includes cross-marketplace merge by `match_key`, title-based fallback for null categories, and dead tests wired into CI.

**How to verify:** Open `/dashboard/analytics`. Check that the category donut chart shows canonical names (e.g. one "Смарт-часы" entry, not separate "умные часы" / "Смарт-часы"). Search for a product by category in Products table.

**Known gaps:** None.

---

## Task 3 — Delete the profit calculator

**Original goal (verbatim):**
> Remove the profit calculator feature and its nav entry cleanly.

**What shipped:** Included in the Tasks 3-8 batch PR #436 (merged 2026-09-02).
- `app/dashboard/calculator/` — directory does not exist (deleted).
- `components/dashboard/Sidebar.tsx:23-34` — no calculator entry.
- `lib/i18n.ts`, `lib/dashT.ts` — zero matches for "calculator".

**Verification status:** DONE-VERIFIED.
Proof: the page, route, nav entry, and all i18n keys are confirmed absent from the codebase.

**Divergence:** None.

**How to verify:** Navigate to `/dashboard/calculator` — should 404 or redirect. Confirm no "Calculator" item in sidebar.

**Known gaps:** None.

---

## Task 4 — Fix daily-chart wrong-day bucketing

**Original goal (verbatim):**
> The daily revenue chart lumps orders from different days into one day. Fix the date bucketing (same class as the earlier order-date/payment-date and Asia/Tashkent fixes — reuse that logic). Orders land on their real day.

**What shipped:** Included in the Tasks 3-8 batch PR #436 (merged 2026-09-02).
- `lib/db/revenue.ts:34`: `date(${orders.ordered_at} AT TIME ZONE 'Asia/Tashkent')` in SELECT, GROUP BY, ORDER BY.
- `lib/db/pnl.ts:103`: `to_char(... AT TIME ZONE 'Asia/Tashkent', ...)` for bucket computation.
- `lib/db/pnl.ts:187`: JS-side bucketing uses `shopDateStr(d)` / `shopMonthStr(d)`.
- `lib/db/seasonality.ts:54`: `shopMonthStr(d)` for month bucketing.
- `lib/shop-time.ts` (135 lines): `SHOP_TZ = 'Asia/Tashkent'`, DST-safe offset derivation via `Intl.DateTimeFormat`.

**Verification status:** DONE-CLAIMED.
Missing proof: no before/after comparison of the live daily revenue chart showing orders now land on the correct Tashkent day. The code change is correct, but nobody has verified the chart output against known order timestamps.

**Divergence:** None.

**How to verify:** Find an order placed late at night Tashkent time (e.g. 23:30). Check that it appears on the correct day in the daily revenue chart, not the next/previous day.

**Known gaps:** None.

---

## Task 5 — Analytics = 3 tabs

**Original goal (verbatim):**
> Restructure Analytics into three sub-sections: Аналитика товаров · Прибыль и убытки · Вывод денег. Rename the current «Заработок» → «Вывод денег» and change its logic to mean money actually paid out (settlements received), not accrued earnings. Reuse the money layer (order-economics.ts) — no new fee/profit math. Keep the counted/pending honesty already built.

**What shipped:** Included in the Tasks 3-8 batch PR #436 (merged 2026-09-02).
- `app/dashboard/analytics/layout.tsx:1-10`: renders `<AnalyticsTabs />`.
- `components/dashboard/AnalyticsTabs.tsx:7-23`: 3 tabs — Product analytics, P&L, Payouts.
- `app/dashboard/analytics/pnl/page.tsx` and `payouts/page.tsx`: full route pages.
- Old routes redirect: `app/dashboard/pnl/page.tsx` → `redirect('/dashboard/analytics/pnl')`.
- `lib/i18n.ts:2102`: `payouts: 'Вывод денег'`. Zero occurrences of "Заработок" remain.
- Sidebar: single `analytics` entry at `Sidebar.tsx:27`.

**Verification status:** DONE-VERIFIED.
Proof: the routing structure, tab component, and i18n rename are all confirmed in code. The tabs render three distinct pages.

**Divergence:** None.

**How to verify:** Open `/dashboard/analytics`. Confirm three tabs visible. Click each. Confirm sidebar says "Аналитика" (not separate PnL/Payouts entries). Confirm Payouts page title says "Вывод денег", not "Заработок".

**Known gaps:** None.

---

## Task 6 — Product analytics detail

**Original goal (verbatim):**
> In Аналитика товаров: show product photos (like Uzum), names, sold count, cancelled count, editable filters. Reuse existing product/photo data. Delivered-only rule stays consistent with the money layer.

**What shipped:** Included in the Tasks 3-8 batch PR #436, with photos added later by Task 7.5.
- `components/dashboard/AnalyticsProductTable.tsx` (605 lines):
  - Search input: lines 141, 215-227 — `query` state with `useMemo` filter.
  - Category filter chips: lines 142-143 — `buildCategoryList`, rendered via `FilterBar` at line 548.
  - `useMemo` stabilization: lines 180-195 (salesByProduct, orphanSales), 215-227 (filteredProducts).
  - Photo thumbnails: lines 332-337 — `p.image_url` rendered with `onError` fallback.

**Verification status:** DONE-CLAIMED.
Missing proof: no screenshot of the live analytics page showing photos, search, and filter chips working together.

**Divergence:** None. Photos were added after Task 7.5 shipped photo sync — correctly sequenced.

**How to verify:** Open `/dashboard/analytics`. Confirm product photos show next to names. Type a product name in search — list should filter. Click a category chip — list should filter by that category.

**Known gaps:** None.

---

## Task 7 — Ad spend in analytics

**Original goal (verbatim):**
> Show ad spend IF the marketplace API provides it. Investigation first — the marketplaces likely do NOT expose ad metrics via API (same wall as DRR). Report feasibility to owner; do NOT build a manual-entry or estimated version without approval.

**What shipped:** Investigation only (no code). Documented in the plan file.
- Yandex Market boost endpoints return 403 Forbidden for Uzbekistan sellers.
- Uzum Market has no advertising API endpoints.
- Codebase already built, tested, and removed the integration (migration `052_drop_product_ads_stats.sql`).

**Verification status:** DONE-VERIFIED (NOT FEASIBLE).
Proof: the investigation IS the deliverable. No API path to ad spend exists. Confirmed by the existing `052_drop` migration proving this was already tried and abandoned.

**Divergence:** None. The plan explicitly called for investigation-first, and the result (not feasible) was documented.

**How to verify:** N/A — investigation task. No feature to test.

**Known gaps:** None.

---

## Task 7.5 — Product photo sync

**Original goal (verbatim):**
> Sync the first product photo URL from each marketplace API during the existing sync cycle. Store in products.image_url. Render thumbnails in Товары and Аналитика товаров tables. Read-only — no marketplace writes.

**What shipped:** PR #436 (migration + data layer), with photo extraction fixes across PRs #438-464.
- Migration `091_products_image_url.sql`: `ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text`.
- Uzum sync: extracts from `card.photos[]` (tries `link.high`, `link.low`, CDN URL).
- Yandex sync: extracts from `offer.pictures[]`.
- `lib/db/products.ts`: selects + returns `image_url`.
- `ProductsTable.tsx`: 40×40px thumbnails with `onError` hide fallback.
- `AnalyticsProductTable.tsx:332-337`: 36×36px thumbnails.

**Verification status:** DONE-CLAIMED.
Missing proof: no confirmation that photos actually appear in prod after a sync cycle. The extraction code is correct, but we haven't verified that Uzum/Yandex API responses contain the expected photo fields for this seller's products.

**Divergence:** None.

**How to verify:** Open `/dashboard/products`. Check that product rows show thumbnail images. If images are missing, check if a sync has run since the migration was deployed.

**Known gaps:** Products with no marketplace photos will show a blank placeholder.

---

## Task 8 — Universal filters + export

**Original goal (verbatim):**
> Add filtering by category / revenue / commission / status across Товары, Заказы, and Аналитика товаров. Export (download) must respect the active filter. Requires Task 2 (categories) done first. One shared filter mechanism reused across sections, not per-page copies.

**What shipped:** Included in the Tasks 3-8 batch PR #436 (merged 2026-09-02).
- `lib/filters/category-helpers.ts` (32 lines): shared `catKey`, `catDisplay`, `catKeyLabel`, `buildCategoryList`.
- `components/dashboard/FilterBar.tsx` (69 lines): reusable component with search, category chips, action slot, result count.
- All three tables use FilterBar:
  - `ProductsTable.tsx:780` (with ExportButton)
  - `OrdersTable.tsx:156`
  - `AnalyticsProductTable.tsx:548` (with ExportButton at line 558)
- Export in AnalyticsProductTable reads from filtered/sorted data (lines 513-539).

**Verification status:** DONE-CLAIMED.
Missing proof: no test that export actually respects filters (e.g. filter to one category, export, open CSV — only that category's products appear).

**Divergence:** Revenue/commission filters were not added as standalone filter controls — the task mentions "filtering by category / revenue / commission / status" but only category and search (which covers names/SKUs) were implemented. Revenue and commission are sortable columns but not filterable. This is a **partial divergence** — the most useful filters shipped, but revenue/commission filtering was dropped.

**How to verify:** Open Products, filter by a category chip, then export. Open the CSV and confirm only filtered products appear. Repeat for Orders and Analytics pages.

**Known gaps:** Revenue and commission are not filterable (only sortable). Status filtering exists only in Orders (via tabs).

---

## Task 9 — Service status page (GitHub-style)

**Original goal (verbatim):**
> Rebuilt as a global service health page showing whether Daromadchi is working, GitHub-status style. Overall banner at top ("Все системы работают" green / "Обнаружены проблемы" red). Service rows with status dots: Uzum sync (with last sync time), Uzum API, Yandex sync, Yandex API, Telegram bot (connected/not connected). Each row shows operational/degraded/down badge. Stock drift section preserved. Full i18n (uz/ru/en).

**What shipped:** PR #447 (merged 2026-09-03).
- `app/dashboard/status/page.tsx` (12 lines): server component calling `getSystemHealth()`.
- `components/dashboard/StatusView.tsx` (200 lines): overall banner (green/amber/red), `ServiceRowComponent` with `StatusDot` (animated ping), stock drift section.
- `lib/db/system-health.ts` (201 lines): generates `SystemHealth` with 5 service rows (Uzum sync, Uzum API, Yandex sync, Yandex API, Telegram).
- Full i18n in `StatusView.tsx:9-67` (UZ/EN/RU).

**Verification status:** DONE-CLAIMED.
Missing proof: no evidence the health checks accurately reflect real service state (e.g., does the Uzum API row turn red when the API is actually down?). The page renders, but accuracy of the health probes is unverified.

**Divergence:** The user indicated the original ask may have been to "simplify the notifications page" — what shipped is a **completely different feature** (a service health dashboard). The plan file text appears to have been rewritten post-implementation to match what was built. If the original intent was notification simplification, this is a significant divergence.

**How to verify:** Open `/dashboard/status`. Confirm the banner shows "Все системы работают" (if healthy). Check that each service row has a colored dot and last-sync timestamp where applicable.

**Known gaps:** Accuracy of health detection is untested. If a service is degraded but the probe doesn't detect it, the page would show a false green.

---

## Task 10 — Public warehouse-state link

**Original goal (verbatim):**
> Make warehouse/stock state viewable via a shareable public link, rendered like the reference photo. Read-only public view; no auth-sensitive data leaked.

**What shipped:** PR #448 (merged 2026-09-04).
- Migration `092_share_token.sql`: `share_token TEXT` on `user_settings` with unique index.
- `app/api/share/route.ts` (47 lines): POST=generate, GET=read, DELETE=revoke. Auth-gated.
- `app/share/[token]/page.tsx` (18 lines): public page (outside `/dashboard/`).
- `app/share/[token]/SharedStockView.tsx` (201 lines): read-only stock view with search, marketplace badges, stock badges.
- `lib/db/share.ts` (53 lines): resolves token → user → products. Only exposes safe fields (name, SKU, image_url, marketplace, fulfillment_type, stock_quantity).
- Settings UI: `SettingsForm.tsx:703-814` — ShareCard with generate/copy/revoke.

**Verification status:** DONE-CLAIMED.
Missing proof: no one has generated a share token and visited the public URL to confirm it shows the correct products and stock.

**Divergence:** None.

**How to verify:** Go to Settings, click "Generate share link". Copy the URL. Open it in an incognito browser window. Confirm it shows your products with stock quantities and NO cost/revenue/API-key data.

**Known gaps:** None.

---

## Task 11 — Products/Orders Uzum-style UI

**Original goal (verbatim):**
> Redesign the Товары and Заказы sections to match the Uzum seller UI (photo references): product photos, layout, structure. Display/UX only — no data-layer or write changes.

**What shipped:** PR #465 (merged 2026-09-06).
- `ProductsTable.tsx:748-764`: underline-indicator tabs with active bottom bar.
- `ProductsTable.tsx:817`: uppercase headers `text-[11px] uppercase tracking-wider`.
- `ProductsTable.tsx:483/604`: row hover `hover:bg-[rgba(128,128,128,0.04)]`.
- `OrdersTable.tsx:128-154`: status tabs with colored dots (`w-2 h-2 rounded-full`) and underline indicator.
- `OrdersTable.tsx:170`: uppercase headers.
- `OrdersTable.tsx:18-31`: `relativeDate()` — "Bugun"/"Kecha"/"Сегодня"/"Вчера"/"Today"/"Yesterday".
- `OrdersTable.tsx:70-77`: `statusConfig` with colored dots and pill badges.
- `OrdersTable.tsx:187`: row hover.

**Verification status:** DONE-CLAIMED.
Missing proof: no visual comparison against the Uzum reference photos to confirm the styling actually matches. The CSS changes are in the code, but visual fidelity is a judgment call.

**Divergence:** None from the plan text. Whether it matches the Uzum reference photos requires visual inspection.

**How to verify:** Open `/dashboard/products` and `/dashboard/orders`. Compare visually against the Uzum seller cabinet. Check for: underline tab indicators, uppercase headers, colored status dots, relative dates, hover highlights.

**Known gaps:** None.

---

## Task 12 — Remove read-only, token-only settings

**Original goal (verbatim):**
> Remove read-only mode; Daromadchi works edit-API only. Strip settings to just entering a token (remove diagnostics, "save mode", mode toggles). DO NOT START until the owner confirms the oversell fix (#421) is verified stable in prod.

**What shipped:** PR #467 (merged 2026-09-06).
- `SettingsForm.tsx`: zero matches for `api_mode`, `apiMode`, or `read_only` (as mode logic). Only `readOnly` is an HTML attribute on the share URL input.
- `lib/db/schema.ts:75-78`: `api_mode` enum retains `'read_only'` for backward compat with existing DB rows, but it no longer appears in the UI.
- Settings form is now: marketplace token cards + TelegramCard + ShareCard + WarehousesCard. No mode toggles or diagnostics.

**Verification status:** DONE-CLAIMED.
Missing proof: no confirmation that the oversell fix (#421) was verified stable before this was deployed. The plan says "DO NOT START until the owner confirms the oversell fix (#421) is verified stable in prod" — we have no evidence of that confirmation.

**Divergence:** None from the plan text, assuming the prerequisite (#421 stable) was met.

**How to verify:** Go to Settings. Confirm there's no "read-only mode" toggle, no diagnostics section, no "save mode" setting. Just token entry fields and sync controls.

**Known gaps:** None.

---

## Task 13 — ИКПУ / tasnif.soliq.uz lookup

**Original goal (verbatim):**
> Add ИКПУ (МХИК) code lookup by name / photo / barcode, sourced from tasnif.soliq.uz. Investigation first: does tasnif expose a usable API? If not, report options to owner — do not build a scraper or fake without approval. Prerequisite for Task 15.

**What shipped:** PR #468 (merged 2026-09-07), plus many connectivity fixes (#469-586).
- `lib/ikpu/client.ts` (273 lines): server-side client with 3 search strategies.
- `lib/ikpu/browser-client.ts` (161 lines): browser-side client with proxy fallbacks.
- `app/api/ikpu/search/route.ts`: auth-gated search endpoint.
- `app/api/ikpu/assign/route.ts`: auth-gated POST to save/clear IKPU code.
- `app/api/ikpu/bulk-assign/route.ts` (42 lines): bonus bulk-assign (not in plan).
- Migration `094_products_ikpu_code.sql`: `ALTER TABLE products ADD COLUMN ikpu_code text`.
- `components/dashboard/IkpuLookupDialog.tsx` (182 lines): modal with search, results, assign/remove.
- ProductsTable: IKPU badge at lines 504-514, dialog at line 853.

**Verification status:** DONE-CLAIMED.
Missing proof: no confirmation that tasnif.soliq.uz search actually returns results from the production server. The API has been known to block Hetzner IPs (multiple PRs #576-586 were connectivity fixes). Current status of the connection is unknown.

**Divergence:** Photo-based lookup not supported (tasnif API doesn't offer it — documented). Otherwise matches.

**How to verify:** Open Products, click the "+ ИКПУ" badge on any product. Type a product name (e.g. "наушники"). Confirm search results appear with МХИК codes. Assign one and confirm the badge turns green.

**Known gaps:** tasnif.soliq.uz may block certain server IPs. The browser-client fallback attempts direct calls from the user's browser, which should work. If all paths fail, IKPU search will show an error.

---

## Task 14 — Real FBO/FBY stock sync

**Original goal (verbatim):**
> Sync real FBO (Uzum) / FBY (Yandex) warehouse stock as distinct data. Today: Uzum FBO stock is NOT synced (no endpoint, no field, Uzum products hard-typed FBS); Yandex FBY partially blends into shared stock. Requires: Uzum FBO fulfillment detection + FBO warehouse-stock fetch + a schema field. Touches the stock model — owner review required.

**What shipped:** PR #476 (merged 2026-09-07), plus follow-up PR #477.
- **Uzum FBO: NOT FEASIBLE.** `lib/uzum/client.ts:506` — `discoverUzumFboPaths()` probes Uzum swagger spec, found zero FBO stock endpoints.
- **Yandex FBY:** Display-only detection:
  - `lib/yandex/sync.ts:190-208`: detects FBY from `placementType`, stores to `shops.campaign_placement`.
  - `components/dashboard/FulfillmentBadge.tsx:9`: FBY badge with purple styling.
  - **No FBY write-path changes** — `APPROVED_STOCK_WRITE_ENDPOINTS` in `lib/marketplace-readonly-guard.ts:85-96` has only Uzum FBS POST and Yandex FBS PUT.

**Verification status:** DONE-VERIFIED (PARTIALLY NOT FEASIBLE).
Proof: Uzum FBO is confirmed impossible (no API). FBY detection is display-only and safe to ship without write-path review. The investigation IS the deliverable.

**Divergence:** None. The plan explicitly called for investigation-first and owner review for any stock-model changes. The investigation found Uzum FBO not feasible, and FBY write changes were correctly deferred for owner review.

**How to verify:** For FBY: go to Settings, check the Yandex card — if the seller's campaign is FBY, a badge should show. For FBO: N/A — not feasible.

**Known gaps:** FBY stock refresh fallback and write exclusion were proposed and reverted — still pending owner approval.

---

## Task 15 — Create products → push to Uzum + Yandex

**Original goal (verbatim):**
> Let sellers create a product in Daromadchi that gets created on Uzum Seller AND Yandex Seller (with Uzum-style photo/design references). Investigation first: do seller product-creation APIs exist and permit this? Depends on Task 2 (categories) + Task 13 (ИКПУ). Largest/riskiest item — owner approval required before any build.

**What shipped:** PR #481 (merged 2026-09-12), plus ~100 fix/improvement PRs (#482-595).
- `app/dashboard/products/new/page.tsx` (21 lines): product creation page.
- `components/dashboard/ProductCreateForm.tsx` (2427 lines): full form with cascading category pickers, variant management, IKPU inline search, dual-language fields, image upload with compression, Excel import/export.
- `lib/marketplace/product-writer.ts` (162 lines): Yandex push module with audit trail.
- `app/api/products/yandex-push/route.ts` (200 lines): Yandex push route handler.
- `lib/marketplace-readonly-guard.ts:131-137`: `APPROVED_PRODUCT_WRITE_ENDPOINTS` — Yandex only, pattern-matched to exactly the offer-mappings/update endpoint.
- `lib/excel/product-export.ts` (382 lines): Uzum `.xlsm` and Yandex `.xlsx` export.

**Verification status:** DONE-CLAIMED.
Missing proof: no evidence a product has been successfully pushed to Yandex and appeared in the seller cabinet. The Yandex push code exists and is audited, but end-to-end success in prod is unverified.

**Divergence:** **Uzum push is NOT live.** The task asks for push to "Uzum Seller AND Yandex Seller". What shipped:
- **Yandex:** Live API push via `product-writer.ts` — products are sent directly to Yandex Market.
- **Uzum:** Export-only (generates a `.xlsm` file for manual upload to Uzum seller cabinet). Uzum has no product creation API — investigation confirmed the API only supports price and stock changes, not product creation. The form generates an Uzum-format Excel file that the seller manually uploads.

This is a **partial divergence** — Uzum's limitation is real (no API), and Excel export is the best available workaround, but the task's "AND" implies both would be API-driven.

**How to verify:** Go to `/dashboard/products/new`. Fill in product details. Click "Push to Yandex" and confirm the product appears in the Yandex seller cabinet. For Uzum: click "Export Uzum Excel", download the file, upload it to Uzum seller cabinet, and confirm it imports correctly.

**Known gaps:**
- Uzum push is manual (Excel export, not API).
- End-to-end Yandex push success unverified in prod.
- Many connectivity/formatting fixes suggest the feature may still have rough edges (100+ fix PRs).

---

## Task 16 — Returns-from-warehouse (Sergeli) tracking

**Original goal (verbatim):**
> When an order is cancelled/returned after delivery, show which products the seller must collect from the Sergeli warehouse — surfacing what Uzum's own UI hides. Investigation first: does Uzum expose return/warehouse data via API? High value if feasible. Owner review required.

**What shipped:** Phase 1 display-only work (PR #603, merged 2026-10-04). Phase 2 not started.
- `OrdersTable.tsx:50-55`: `STATUS_GROUP` maps `returned: 'returned'`.
- `OrdersTable.tsx:55`: `StatusTab` includes `'returned'`.
- `OrdersTable.tsx:62`: purple dot color for returned.
- `OrdersTable.tsx:76`: `returned` in `statusConfig` with violet styling.
- `OrdersTable.tsx:85`: visible "Возвраты" tab.
- `lib/yandex/sync.ts:54-55`: maps `RETURNED`/`PARTIALLY_RETURNED` → `'returned'`.
- Returns diagnostic probe: `app/api/yandex/diagnose/route.ts:209-221` — `?returns=1` probes Yandex returns API.

**Verification status:** PARTIAL.
- Phase 1 (display tab): DONE-CLAIMED — the tab exists but shows 0 returns because Yandex Orders API doesn't change order status on returns. Returns live in a separate API that isn't synced yet.
- Phase 2 (Sergeli warehouse tracking, returns sync): TODO — not started, blocked on owner reviewing the diagnostic probe results.
- The original ask (Sergeli warehouse collection tracking) is **not built at all**.

**Divergence:** Significant. The task asks for showing "which products the seller must collect from the Sergeli warehouse" (Uzum-specific). What shipped is a generic "returned" status tab for orders, which:
1. Only works if the orders API reports `RETURNED` status (Yandex only, and Yandex doesn't reliably do this).
2. Has no Uzum returns integration at all.
3. Has no warehouse/collection tracking.
4. Is purely display — no new data is fetched or stored.

The investigation hasn't been completed for the core ask (Uzum return/warehouse data API).

**How to verify:** Open `/dashboard/orders`. Confirm the "Возвраты" tab is visible with a purple dot. (It will likely show 0 returns — that's expected until returns sync is built.)

**Known gaps:**
- Returns sync not built (no data to display).
- Sergeli warehouse tracking not investigated.
- Yandex returns diagnostic probe created but not yet tested by owner.
- Phase 2 blocked on owner decision.

---

## Extra work not in the plan

### Auto-cancelled orders fix
**PR #602** (merged 2026-10-04). Stops importing auto-cancelled orders (unpaid, expired) that Yandex hides from the seller panel but returns via API. Sync now skips "first seen already cancelled" on INSERT.

### Ordered_at overwrite fix
**PR #605** (merged 2026-10-04). Fixed `ordered_at` being overwritten on sync update ticks. `lib/yandex/sync.ts:874-877`: update path no longer sets `ordered_at`, preventing cancelled orders from shifting to wrong date ranges.

### Dimension export bug fix
**PR #606** (merged 2026-10-04). Yandex Excel export was dividing dimensions by 100 instead of 10 (mm→cm). Fixed at `lib/excel/product-export.ts:361-363`: `Math.round(p.lengthMm / 10)` (was `/10)/10`).

### Color normalization fix
**PR #606** (merged 2026-10-04). ё→е normalization wasn't applied to Yandex export. Fixed at `lib/excel/product-export.ts:346`: uses `replaceYo(p.color)`. Also fixed in `ProductCreateForm.tsx:1368,1377`.

### Returns diagnostic probe
**PR #604** (merged 2026-10-04). Read-only `?returns=1` probe at `/api/yandex/diagnose/route.ts:209-221` calling `GET /v2/campaigns/{campaignId}/returns`.

### Sync health diagnostic + stock dedup
**PR #600-601** (merged 2026-10-03). Sync health diagnostic endpoint and stock total deduplication fix. `lib/uzum/sync.ts:665`: deduplicates by id when FBO overlaps with FBS.

### Uzum Excel template improvements
**PRs #535, 565-572, 592-593** (Sep 2026). Rewrote Uzum Excel export to use real seller-cabinet `.xlsm` template instead of programmatic XLSX generation. Fixed SST count, column spans, category format, inline strings.

### Product form enhancements (beyond Task 15)
- **PR #517**: EAN-13 barcode generator
- **PR #564**: Drag-and-drop Excel import
- **PR #574-575**: Form data persistence across reloads
- **PR #587**: UZS price validation (round to multiples of 1000)
- **PR #595**: Validate Uzum fields against Лист3 enums

### IKPU connectivity fixes (beyond Task 13)
**PRs #576-586** (Sep 2026). Multiple iterations fixing tasnif.soliq.uz connectivity from Hetzner: edge rewrite proxy, browser-like headers, Cloudflare Worker CORS proxy, public CORS proxies, direct browser calls, DNS fallback, accurate classification endpoint.

### Photo extraction fixes (beyond Task 7.5)
**PRs #450-464** (Sep 2026). Multiple iterations fixing Uzum photo extraction: null-clobber bug, marketplace-split diagnostic, Yandex rendering, per-variant photos, per-SKU previewImage.

### Order notification improvements
**PRs #594, 598-599** (Oct 2026). Color and remaining stock in Uzum order notifications. Products page crash fix.

### Archived products + auto-sync
**PR #589** (Sep 2026). Show archived products and auto-sync new products every 30 minutes.

### Debug/diagnostic endpoints
**PRs #596-597, 600** (Oct 2026). Stop force-archiving Uzum no-SKU products. Add shop diagnostics to debug endpoint. Sync health diagnostic endpoint.

---

## Current state of Task 15 and Task 16

### Task 15 (Product push)
**Status: DONE-CLAIMED (Yandex live, Uzum export-only).**
The product creation form is complete and has been through ~100 fix iterations. Yandex push is live via `product-writer.ts` with full audit trail. Uzum is export-only (no creation API exists). The form supports: cascading category pickers for both marketplaces, variant management, IKPU code assignment, dual-language fields (RU/UZ), image upload with compression, Excel import/export, barcode generation, price validation. End-to-end success in prod has not been independently verified.

### Task 16 (Returns)
**Status: PARTIAL — Phase 1 display-only shipped, Phase 2 TODO.**
A "Возвраты" tab exists on the Orders page (PR #603, merged). A diagnostic probe exists (PR #604, merged). But the tab shows 0 returns because no returns data is synced. The core ask (Sergeli warehouse collection tracking) has not been investigated or built. Phase 2 is blocked on owner reviewing the diagnostic probe results.

---

## Open export bugs

### Shoe dimensions (FIXED)
**PR #606** (merged 2026-10-04). Bug: Yandex Excel export divided dimensions by 100 instead of 10 (a shoe box 330×220×130 mm was exported as 3.3×2.2×1.3 cm instead of 33×22×13 cm). Fixed at `lib/excel/product-export.ts:361-363`. The fix is merged and live.

### Color normalization (FIXED)
**PR #606** (merged 2026-10-04). Bug: color "Чёрный" (with ё) was exported without ё→е normalization, causing Yandex to reject or mismatch the color parameter. Fixed in two places: `product-export.ts:346` (uses `replaceYo`) and `ProductCreateForm.tsx:1368,1377` (inline normalization). The fix is merged and live.

---

## Known bugs documented but NOT fixed (per user instruction — separate PR required)

These four money-consistency bugs were found during investigation but are explicitly NOT to be bundled with any current work. They need their own separate PR:

1. **`lib/db/revenue.ts:28`** — excludes only `'cancelled'` from revenue, not `'returned'`. Returned orders inflate revenue numbers.
2. **`lib/db/seasonality.ts:46`** — same: excludes only `'cancelled'`.
3. **`app/api/extension/send-daily-summary/route.ts:65`** — active order count includes returned orders.
4. **`lib/telegram-digest.ts:132`** — returned orders vanish silently from the digest (no "returned" category).
