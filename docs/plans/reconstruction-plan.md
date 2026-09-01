# Daromadchi Reconstruction Plan

**How CC uses this file:** Read this at the start of every session. Work through tasks marked **[SAFE]** in order — do the task, open a PR, change its status to `DONE` here (commit that change), then continue to the next `[SAFE] TODO`. When you reach a **🛑 STOP-REVIEW** task, STOP and wait for the owner (Jama). Do not start a STOP-REVIEW task on your own.

**Absolute rules (never violate, even under time pressure):**
- Never modify marketplace **write** paths, the stock **ledger/pool** logic (#421), or the read-only/edit-mode settings without explicit owner approval. These are 🛑 tasks.
- Every task = its own branch, one concept. Open a PR; do not merge (the owner merges).
- For any task that could affect stock numbers, money figures, or marketplace writes: include a verification step and flag it for owner review — do not assume "done" means "correct."
- If a task's investigation shows the feature isn't feasible (e.g. no API), STOP and report — do not build a fake version.
- Prefer reusing existing modules (money layer `order-economics.ts`, `format-sum.ts`, `CalendarPicker`, the notif registry) over new implementations.

**Status legend:** `TODO` · `IN-PROGRESS` · `DONE` · `BLOCKED`

---

## Phase 1 — Foundations & cleanups

### Task 1 — [SAFE] Move stock into «Товары», Uzum-style — status: DONE (PR open — owner to verify parity + decide on photos)
Relocate the standalone «Остатки» view into the Products («Товары») section. Lay out like the Uzum seller Products table: row = product photo + name + SKU/ID + status badge + **«Остатки FBS, шт»** column. Delete the standalone Остатки page/route and its nav entry.
- Show **FBS only** for now (real, both marketplaces). Do NOT add an FBO column — FBO is not synced (see Task 14); a blank FBO column is misleading. Add FBO here only after Task 14.
- Drop the old page's per-marketplace sold/cancelled/«Отменено» split (owner's decision — Products view is a clean product+stock table).
- **Display relocation only** — do NOT change stock computation or the write path (#421 intact). Parity check: FBS numbers shown must equal what the old Остатки page showed.

> **CC note (what shipped):** Added an **«Остатки FBS, шт»** column to the Products table, reusing the SAME `available_stock` figure the low-stock tab/export and the old Остатки page already computed — no stock math changed (#421 untouched). FBO/FBY listings show «—» (not synced). Deleted the standalone view: `/dashboard/stocks` now redirects to `/dashboard/products` and the sidebar entry is gone. Sold/cancelled split dropped as instructed.
> **⚠️ Owner to verify:** (1) **Parity** — the old page grouped SKUs *across* marketplaces into one leftover; Products shows one row *per listing*, each reading the same shared pool. Please confirm the per-listing FBS numbers match what you saw before. (2) **Photos** — products carry **no photo data** (sync never stores an image; the `image` column is on `unit_economics_items`, not `products`), so the Uzum-style photo was NOT added rather than faked — it needs a photo-sync feature (fits Task 11/14 scope). (3) The cross-marketplace **merge-suggestions** tool (`ProductGroupSuggestions`) lived on the deleted page; its code is kept but currently unlinked — where should it live?

### Task 2 — [SAFE] Category mapping — status: DONE
Daromadchi isn't picking up Russian categories. Investigate why, then map synonyms to one canonical category (e.g. «умные часы» + «смартчасы» → one). Foundation for filters (Task 8) and analytics (Task 5/6). Deliver a mapping mechanism, not a one-off patch.

> **CC note (what shipped):** Root cause: the `category_aliases` table was empty in prod — the Cyrillic-aware `matchCategory` matcher existed but was only called by a manual script, never at runtime. Fix: a runtime `resolveCanonical()` function (`lib/categories/resolve.ts`) that calls the existing matcher against the 40-category taxonomy and caches results. Wired into: (1) `_fetchCategoryRevenue` merge layer — synonyms now collapse in the category donut chart and analytics, both in the canonical-join path and the fallback path; (2) `ProductsTable` — category badges, filter chips, search, and export all show canonical names and deduplicate synonyms; (3) `SeasonalityView` — category label canonicalized. No DB writes, no new tables, no sync-path changes. Test: `test:categories` (11 assertions, CI-wired via `node --test`) proves «умные часы» + «Смарт-часы» → same `smart_watches` merge key, cross-marketplace collapse, trilingual names, fallback for unknown categories.
> **Pre-existing gap found:** `lib/categories/matcher.test.ts` uses vitest in a repo that runs `node --test` — it never ran in CI. Not fixed here (separate concern), but noted.

### Task 3 — [SAFE] Delete the profit calculator — status: DONE
Remove the profit calculator feature and its nav entry cleanly.
> **CC note (what shipped):** Deleted `app/dashboard/calculator/` (page + loading skeleton). Removed sidebar nav entry and `Calculator` icon import from `Sidebar.tsx`. Removed all calculator i18n keys from `lib/i18n.ts` (3 locales) and `lib/dashT.ts` (3 locales). Removed calculator section from `lib/help-tooltips.ts` (type + content). Updated `lib/help-content.ts` in all 3 locales: redirected ~50 "Dashboard → Calculator" references to "Dashboard → Unit Economics", removed standalone calculator sections from unit-economics/break-even/margin/logistics articles. Updated landing page copy (subtitles, value props, testimonials) in all 3 locales. Removed calculator card from `public/architecture.html` and `ARCHITECTURE.md`. Restored `category` and `costPriceLabel` i18n keys that were shared with `ProductsTable`. TypeScript and ESLint clean (0 errors).

### Task 4 — [SAFE] Fix daily-chart wrong-day bucketing — status: DONE
The daily revenue chart lumps orders from different days into one day. Fix the date bucketing (same class as the earlier order-date/payment-date and Asia/Tashkent fixes — reuse that logic). Orders land on their real day.
> **CC note (what shipped):** Root cause: SQL `date(ordered_at)` and `to_char(ordered_at, ...)` used the Postgres session timezone (UTC) instead of the seller's timezone. An order placed at 02:00 Tashkent (21:00 UTC the previous day) was bucketed into the wrong calendar day. Fix: added `AT TIME ZONE 'Asia/Tashkent'` to all SQL date-bucketing expressions in `lib/db/revenue.ts` (daily revenue chart) and `lib/db/pnl.ts` (P&L bucketing). JS-side bucketing in pnl.ts replaced `getFullYear()/getMonth()/getDate()` with `shopDateStr()`/`shopMonthStr()` from `lib/shop-time.ts`. Same fix applied to `lib/db/seasonality.ts`. Fixed `app/dashboard/pnl/page.tsx` parseRange to use `parseLocalDate`/`parseLocalDateEnd` instead of process-local `new Date()`. Fixed revenue.ts label formatting to use `timeZone: 'UTC'` for deterministic rendering. All changes follow the existing `AT TIME ZONE 'Asia/Tashkent'` pattern from `lib/db/payouts.ts`.

---

## Phase 2 — Analytics restructure

### Task 5 — [SAFE] Analytics = 3 tabs — status: DONE
Restructure Analytics into three sub-sections: **Аналитика товаров · Прибыль и убытки · Вывод денег**. Rename the current «Заработок» → **«Вывод денег»** and change its logic to mean money actually paid out (settlements received), not accrued earnings. Reuse the money layer (`order-economics.ts`) — no new fee/profit math. Keep the counted/pending honesty already built.
> **CC note (what shipped):** Created `app/dashboard/analytics/layout.tsx` with `AnalyticsTabs` component providing 3 URL-driven tabs (Product analytics, P&L, Payouts). Moved P&L route from `app/dashboard/pnl/` → `app/dashboard/analytics/pnl/` and Payouts from `app/dashboard/payouts/` → `app/dashboard/analytics/payouts/`. Old routes redirect via `next/navigation.redirect()`. Removed `pnl` and `payouts` from sidebar nav (`storeNavItems`); analytics entry now highlights for all sub-routes. Updated BottomNav to match. Renamed "Заработок"/"Earnings"/"Daromad" → "Вывод денег"/"Payouts"/"To'lovlar" in i18n.ts (nav + page title/subtitle, 3 locales). Removed dead `finances → pnl/payouts` lock from `nav-gating.ts` (pages still self-gate). Underlying data logic unchanged — `getPayoutEntries` already reads settlement data.

### Task 6 — [SAFE] Product analytics detail — status: TODO
In Аналитика товаров: show product photos (like Uzum), names, sold count, cancelled count, editable filters. Reuse existing product/photo data. Delivered-only rule stays consistent with the money layer.

### Task 7 — 🛑 STOP-REVIEW — Ad spend in analytics — status: TODO
Show ad spend IF the marketplace API provides it. **Investigation first** — the marketplaces likely do NOT expose ad metrics via API (same wall as DRR). Report feasibility to owner; do NOT build a manual-entry or estimated version without approval.

---

## Phase 3 — Filters, notifications, sharing

### Task 8 — [SAFE] Universal filters + export — status: TODO
Add filtering by category / revenue / commission / status across Товары, Заказы, and Аналитика товаров. Export (download) must respect the active filter. Requires Task 2 (categories) done first. One shared filter mechanism reused across sections, not per-page copies.

### Task 9 — [SAFE] Simplify notifications page — status: TODO
Delete «Состояние склада». Replace with a simple alerts feed: order received, order cancelled, stock remaining, weekly summary, etc. Add a "connect Telegram notifications" button. Make it maximally simple. Reuse the existing notif registry/plumbing.

### Task 10 — [SAFE] Public warehouse-state link — status: TODO
Make warehouse/stock state viewable via a shareable public link, rendered like the reference photo. Read-only public view; no auth-sensitive data leaked.

---

## Phase 4 — UI redesign

### Task 11 — [SAFE] Products/Orders Uzum-style UI — status: TODO
Redesign the Товары and Заказы sections to match the Uzum seller UI (photo references): product photos, layout, structure. Display/UX only — no data-layer or write changes.

---

## Phase 5 — Settings / edit-only (GATED on oversell fix)

### Task 12 — 🛑 STOP-REVIEW — Remove read-only, token-only settings — status: TODO
Remove read-only mode; Daromadchi works edit-API only. Strip settings to just entering a token (remove diagnostics, "save mode", mode toggles). **DO NOT START until the owner confirms the oversell fix (#421) is verified stable in prod (a seller-set 0 stays 0 through a sync).** Removing read-only puts every shop permanently on the write path — unsafe until #421 is proven. Owner approval required.

---

## Phase 6 — Big API-dependent features (investigation-first, highest risk)

### Task 13 — 🛑 STOP-REVIEW — ИКПУ / tasnif.soliq.uz lookup — status: TODO
Add ИКПУ (МХИК) code lookup by name / photo / barcode, sourced from tasnif.soliq.uz. **Investigation first:** does tasnif expose a usable API? If not, report options to owner — do not build a scraper or fake without approval. Prerequisite for Task 15.

### Task 14 — 🛑 STOP-REVIEW — Real FBO/FBY stock sync — status: TODO
Sync real FBO (Uzum) / FBY (Yandex) warehouse stock as distinct data. Today: Uzum FBO stock is NOT synced (no endpoint, no field, Uzum products hard-typed FBS); Yandex FBY partially blends into shared stock. Requires: Uzum FBO fulfillment detection + FBO warehouse-stock fetch + a schema field. **Touches the stock model — owner review required.** Unblocks a real FBO column in Task 1's view.

### Task 15 — 🛑 STOP-REVIEW — Create products → push to Uzum + Yandex — status: TODO
Let sellers create a product in Daromadchi that gets created on Uzum Seller AND Yandex Seller (with Uzum-style photo/design references). **Investigation first:** do seller product-creation APIs exist and permit this? Depends on Task 2 (categories) + Task 13 (ИКПУ). Largest/riskiest item — owner approval required before any build.

### Task 16 — 🛑 STOP-REVIEW — Returns-from-warehouse (Sergeli) tracking — status: TODO
When an order is cancelled/returned after delivery, show which products the seller must collect from the Sergeli warehouse — surfacing what Uzum's own UI hides. **Investigation first:** does Uzum expose return/warehouse data via API? High value if feasible. Owner review required.

---

## Session resume
At the start of each session, CC: reads this file → finds the first `[SAFE] TODO` → does it → opens PR → marks `DONE` here → next `[SAFE] TODO`. On reaching a `🛑 STOP-REVIEW`, stop and wait for the owner. The owner triggers each session and merges PRs.
