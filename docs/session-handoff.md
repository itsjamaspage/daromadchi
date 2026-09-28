# Session Handoff — Full History & Task Plan

**Date:** 2026-09-28
**Session:** https://claude.ai/code/session_011rzpUNXyjyeSdecw9LnMdY
**Repo:** itsjamaspage/daromadchi (Next.js marketplace analytics dashboard for Uzum Market + Yandex Market)

---

## CRITICAL SECURITY RULE (MUST preserve verbatim)

> Marketplace API access is READ-ONLY BY DEFAULT. The app MUST NEVER send PUT, PATCH, or DELETE requests to any external marketplace API (Yandex Market, Uzum Market, Wildberries, or any other marketplace/e-commerce platform), except through the single sanctioned exception described below.

> POST is only allowed when the marketplace API itself requires POST for a READ operation (e.g. Yandex offer-mappings, stocks, stats endpoints return 405 on GET — those specific approved endpoints are listed in `lib/marketplace-readonly-guard.ts`).

> THE ONE SANCTIONED WRITE EXCEPTION — opt-in, audited, stock-quantity-only: A single per-shop "Stock-sync (edit)" mode may update ONLY the stock quantity (ostatok) on a seller's live listing. Every such write goes through `lib/marketplace/stock-writer.ts` and is audited in `stock_write_log`. A second path (`lib/marketplace/order-cancel.ts`) may ONLY cancel an order on oversell. Nothing else.

> Product-write is a separately sanctioned write path (approved by owner jkhakimjonov8@gmail.com) ONLY for Yandex offer-mappings/update endpoint via `lib/marketplace/product-writer.ts`.

> Any OTHER code that writes to a marketplace API is FORBIDDEN without explicit written approval from the repository owner.

---

## The 14-Task Reconstruction Plan (+ extra tasks)

### Task 1 — [SAFE] Move stock into Товары — status: DONE
- PR #431 (merged)
- Moved stock display into the products page

### Task 2 — [SAFE] Category mapping — status: DONE  
- PR #432 (merged)
- Wire existing category matcher into live paths so Russian category synonyms (e.g., «умные часы» + «смартчасы») collapse into one canonical category
- Uses `resolveCanonical()` + `matchCategory()` at query/display time with 40-entry taxonomy and Cyrillic-aware matching (3 tiers: exact/substring/token_set Jaccard)

### Task 3 — [SAFE] Delete the profit calculator — status: DONE
- Removed the profit calculator feature

### Task 4 — [SAFE] Fix daily-chart wrong-day bucketing — status: DONE
- Fixed timezone bucketing issue in daily analytics charts

### Task 5 — [SAFE] Analytics = 3 tabs — status: DONE
- Restructured analytics into 3 tabs

### Task 6 — [SAFE] Product analytics detail — status: DONE
- Added detailed per-product analytics view (depended on Task 5)

### Task 7 — 🛑 STOP-REVIEW — Ad spend in analytics — status: TODO
- Needs user review before implementation
- Integrating ad spend data into analytics views

### Task 7.5 — [SAFE] Product photo sync — status: DONE
- Added between tasks 7 and 8
- Syncs first product photo URL from each marketplace API during existing sync cycle
- Stores in `products.image_url`, renders thumbnails in Products table

### Task 8 — [SAFE] Universal filters + export — status: TODO
- Universal filtering mechanism reusable across sections + data export

### Task 9 — [SAFE] Simplify notifications page — status: DONE
- Simplified the notifications interface

### Task 10 — [SAFE] Public warehouse-state link — status: TODO
- Public shareable warehouse-state page
- Should be done after relevant PRs are merged

### Task 11 — [SAFE] Products/Orders Uzum-style UI — status: DONE
- PR #465 (merged)
- Redesigned Товары (Products) and Заказы (Orders) pages to match Uzum seller cabinet UI style
- Clean, professional, modern marketplace seller UI

### Task 12 — 🛑 STOP-REVIEW — Remove read-only, token-only settings — status: TODO
- Research done, implementation not started
- Needs user review

### Task 13 — 🛑 STOP-REVIEW — ИКПУ / tasnif.soliq.uz lookup — status: PARTIALLY DONE
- Investigation complete — tasnif.soliq.uz has a public API at `https://tasnif.soliq.uz/api/cls-api/elasticsearch/search`
- Server-side client built: `lib/ikpu/client.ts` (searchByKeyword, searchByBarcode)
- API route built: `app/api/ikpu/search/route.ts`
- Browser-side search component built: `IkpuSearchField` in ProductCreateForm
- **CORS bug found and fixed** (see "What we did this session" below) — PR #576 open
- Still TODO: deeper integration, auto-assignment, bulk IKPU workflows

### Task 14 — 🛑 STOP-REVIEW — Real FBO/FBY stock sync — status: INVESTIGATION DONE
- Investigation complete: Uzum exposes NO FBO stock endpoint — only FBS stock paths (/v2/fbs/sku/stocks, /v3/fbs/sku/stocks)
- All SKUs are fbsAllowed:true, dbsAllowed:false
- Implementation waiting on review

### Task 15 — 🛑 STOP-REVIEW — Create products → push to Uzum + Yandex — status: TODO
- Depends on Task 13 (IKPU) being done first
- Push product data to marketplace APIs

### Task 16 — 🛑 STOP-REVIEW — Returns-from-warehouse (Sergeli) tracking — status: TODO

### Task 17 — Security audit — status: TODO
- 14 attack vectors investigation

---

## What we did THIS session (chronological)

### 1. Fixed SST count off-by-1 bug in Uzum Excel export
- **PR #572** (merged)
- The Uzum `.xlsm` template export had a SharedStrings Table (SST) count mismatch — the XML `count` and `uniqueCount` attributes were off by one, causing file corruption
- Fixed in `lib/excel/uzum-export.ts`

### 2. Fixed form data loss on language switch
- **PR #574** (merged)
- Problem: `app/providers.tsx` does `window.location.reload()` on language change (line 77), which wipes all React state
- Solution: Auto-save form data to `sessionStorage` on `beforeunload` event, restore on mount
- Added `saveDraftToSession()` / `loadDraft()` functions
- Draft loading priority: sessionStorage first (consumed after load), then localStorage as fallback
- Category paths saved as ID arrays, restored via `resolveIdPath()` after async tree load

### 3. Added explicit "Сохранить данные" save button
- Part of **PR #574** (merged)
- Sticky save bar at top of form with:
  - "Сохранить данные" button — saves to localStorage
  - Timestamp showing last save time
  - Green flash confirmation on save
- Added `collectDraft()` callback that gathers all form state into a `FormDraft` object

### 4. Provided Nike Air Max 90 test product data
- Complete product details for testing the form:
  - Name RU/UZ, descriptions RU/UZ, SKU, brand, model, country
  - Pricing: 890,000 / 1,190,000 sums
  - Dimensions: 850g, 150×300×350mm
  - IKPU: 10404001001000000
  - Photo URL from Nike CDN

### 5. Changed form to start empty + added "Загрузить сохранённое" button
- **PR #576** (open, pending merge)
- User requested: "after reloading remove everything, just add button called upload saved"
- Changes:
  - Removed auto-load of drafts on page load — form starts completely empty
  - Removed `beforeunload` auto-save to sessionStorage
  - Removed `sessionStorage` and `FORM_DRAFT_KEY` entirely
  - Kept "Сохранить данные" (Save data) button — saves to localStorage
  - Added "Загрузить сохранённое" (Load saved) button — explicitly loads saved data from localStorage on click
  - `handleLoadSaved()` applies all saved fields including category paths via `resolveIdPath()`
  - Both buttons show green flash confirmation

### 6. Fixed IKPU search CORS bug
- **PR #576** (open, pending merge — same PR as #5)
- Root cause: `lib/ikpu/browser-search.ts` called `https://tasnif.soliq.uz/api/cls-api/elasticsearch/search` **directly from the browser**, which silently fails because tasnif.soliq.uz doesn't send CORS headers (`Access-Control-Allow-Origin`)
- This is why searching "спортивная обувь" returned wrong results (Coca-Cola) — the CORS error was caught silently
- Fix: Changed both `ProductCreateForm.tsx` and `IkpuTable.tsx` to call `/api/ikpu/search` (the existing server-side proxy route) instead of `searchDirect` from `browser-search.ts`
- The server route calls `searchByKeyword`/`searchByBarcode` from `lib/ikpu/client.ts` which hits tasnif from Node.js — no CORS issue
- Returns full hierarchy: groupName, className, positionName, subPositionName
- `browser-search.ts` is now unused (no imports remain) — can be deleted

### 7. Network environment configuration
- `tasnif.soliq.uz` was blocked by the cloud environment's network proxy (403 on CONNECT)
- User changed environment from "Trusted" → "Custom" with `tasnif.soliq.uz` → back to "Trusted"
- **"Trusted" allows all outbound traffic** — this is the correct setting
- Network changes only apply to **new sessions**, not the current one

---

## Open PRs as of session end

| PR | Description | Status |
|----|-------------|--------|
| [#576](https://github.com/itsjamaspage/daromadchi/pull/576) | Fix IKPU CORS + load-saved button | Open, needs merge |

---

## Key files and their roles

| File | Purpose |
|------|---------|
| `components/dashboard/ProductCreateForm.tsx` | Product creation form — multi-step wizard for creating marketplace product data and exporting as Uzum/Yandex Excel |
| `components/dashboard/IkpuTable.tsx` | IKPU management page — search, assign IKPU codes to products |
| `lib/ikpu/client.ts` | Server-side IKPU search client — calls tasnif.soliq.uz API |
| `lib/ikpu/browser-search.ts` | DEPRECATED — was calling tasnif directly from browser (CORS fail). No longer imported. Can be deleted. |
| `app/api/ikpu/search/route.ts` | API route proxying IKPU search through server to avoid CORS |
| `lib/excel/uzum-export.ts` | Uzum Excel export — generates `.xlsm` files from template |
| `lib/excel/templates/uzum-template.xlsm` | Uzum Excel template with VBA macros |
| `app/providers.tsx` | Language provider — line 77 does `window.location.reload()` on language switch |
| `lib/uzum/public.ts` | Public Uzum API functions |
| `app/api/products/uzum-categories/route.ts` | Category API endpoint |
| `lib/uzum/static-categories.ts` | Template category fallback (5,330 categories from template Лист2) |

---

## Technical notes for next session

1. **Test infrastructure**: Repo uses `node --test` with tsx, NOT vitest. CI runs all `test:*` npm scripts via shell loop in `ci.yml`.

2. **Category tree**: Fetched from live Uzum API with fallback to static categories parsed from template Лист2 sheet.

3. **Form state architecture**:
   - All state is individual `useState` hooks (not a reducer)
   - `collectDraft()` gathers all state into a `FormDraft` object
   - `handleLoadSaved()` applies a `FormDraft` to all state setters
   - Category paths saved as ID arrays, restored via `resolveIdPath(tree, ids)`

4. **Uzum Excel export**: Uses `.xlsm` template. The export works by manipulating the template's XML directly (shared strings, sheet data). SST count must match exactly or the file corrupts.

5. **The user IS the repository owner** (jkhakimjonov8@gmail.com). Never merge PRs without being asked.

6. **Environment**: Cloud session on claude.ai/code. Network policy should be "Trusted" to allow `tasnif.soliq.uz` access. Environment changes only apply to new sessions.

---

## Immediate next steps for new session

1. **Merge PR #576** — fixes IKPU search + adds load-saved button
2. **Verify IKPU search works** after deploy — search "спортивная обувь" should return footwear results with full hierarchy
3. **Continue with remaining tasks** — Tasks 7, 8, 10, 12-17 are still TODO
4. **Consider deleting** `lib/ikpu/browser-search.ts` — no longer imported anywhere
