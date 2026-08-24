# Step 0 — is the stock display actually broken?

**Status:** read-only. No code changed, no fix written.
**Date:** 2026-08-24
**Follows:** `docs/investigations/stock-propagation-findings.md` (#311)

---

## Verdict

**Neither option as written. It is possibility 1's mechanism — the dashboard
never shows `stock_quantity` — but there is a real bug inside that mechanism,
and it is not the one we were looking for.**

- **Possibility 2 (Yandex light-refresh gap): substantially ruled out**, and
  my own §3.4 framing in #311 overstated it. Correction below in §3.
- **Uzum: fully ruled out.** Zero light-vs-heavy asymmetry (§4).
- **Possibility 1: confirmed as the display mechanism** — `ProductsTable.tsx:246`
  renders `available_stock`, never `stock_quantity` (§1).
- **But the `in_transit` term that does the masking is unbounded in time, while
  the order sync only re-reads 30 days.** An order that ages out of the sync
  window still in `pending`/`confirmed` subtracts from displayed stock
  **permanently and cumulatively** (§2). That is not masking that resolves when
  the order completes. It is a floor that only ever rises.

So "no bug, nothing to fix" would be the wrong call, and so would a stock-write
fix. The write path is healthy; the **display's reserved-units term** is wrong.

**One query decides it** — §5, Query B. If it returns rows, §2 is your bug.

---

## 1. The dashboard never displays `products.stock_quantity`

`components/dashboard/ProductsTable.tsx:246`:

```ts
[d.stockQty]:         p.available_stock,
```

The column the seller reads as "stock" is bound to `available_stock`. So are the
low-stock tab filter (`:204`) and the low-stock total (`:251`). `stock_quantity`
survives only as a sort key name (`:50`).

`available_stock` is built in `lib/db/products.ts:102`:

```ts
const availableStock = Math.max(0, p.stock_quantity - dbInTransit)
```

**A restock is netted out unit-for-unit by `dbInTransit` before the seller ever
sees it.** Every write in the chain can be perfect and the number will not move.

That is possibility 1, and it is confirmed at the code level. The remaining
question is whether `dbInTransit` is *legitimately* non-zero.

---

## 2. It is not — `in_transit` has no time bound, and the sync does

### 2.1 The two windows disagree

**The display counts reserved units over all time.** `lib/db/products.ts:41`:

```ts
qty_in_transit: sql`coalesce(sum(${orderItems.quantity})
  filter (where ${orders.status} in ('pending','confirmed')), 0)`
```

and its only predicate is `:45` — `.where(inArray(orders.shop_id, allShopIds))`.
No date filter. Any order row sitting in `pending` or `confirmed`, of any age,
subtracts.

**The sync only refreshes 30 days.** `lib/yandex/sync.ts:493`:

```ts
const ORDER_STATUS_LOOKBACK_DAYS = 30
const FIRST_SYNC_LOOKBACK_DAYS   = 365
```

Yandex's `fromDate` filters by order **creation** date (`:487-492`), so an order
created more than 30 days ago is never re-fetched. **Whatever status it held on
day 30 is its status forever.**

### 2.2 What that produces

An order that ages out of the window while normalized `pending` or `confirmed`
becomes a permanent subtraction from displayed stock. It cannot be corrected,
because nothing will ever look at it again.

The effect is monotonic: each such order lowers the displayed stock by its
quantity, for good. Restock by 4 against 4 accumulated ghost units and the
number does not move. Restock by 10 and it moves by 10 but off a floor that is
too low — which reads exactly like "sometimes it updates, sometimes it doesn't".

### 2.3 Why there is almost certainly a population of these

Three sources, all documented in this repo's own history:

1. **The `?? 'pending'` fallback (fixed in #300).** `PROCESSING`, `DELIVERY` and
   `PICKUP` were unmapped and defaulted to `'pending'`. #300 mapped them to
   `'confirmed'` — **still inside the subtracting set** — and only for orders
   still within the 30-day window. Anything that aged out beforehand kept a
   status that is wrong *and* subtracting.
2. **The 365-day first sync** (`:494`). A shop's initial sync ingests a year of
   orders in one pass. Everything older than 30 days is immediately out of the
   window and frozen at whatever the mapping produced that day.
3. **Terminal states we never observe.** An FBY or FBO order whose completion
   lands after day 30 never gets its terminal status.

### 2.4 The display and the stock engine disagree about "reserved"

Independently of the time bound, there are two definitions of a reserving order
and they are not the same:

| | predicate | source |
| --- | --- | --- |
| **Display** | `orders.status IN ('pending','confirmed')` | `products.ts:41`, `stock-groups.ts:162` |
| **Stock engine / oversell** | `orders.marketplace_status IN RESERVING_RAW_STATUSES` | `reserving-orders.ts:22-27` |

`RESERVING_RAW_STATUSES` (`stock-allocation.ts:49-55`) is five raw statuses —
`ACCEPTED_AT_DP`, `HANDED_OVER`, `TRANSFERRED`, `DELIVERY`, `PICKUP` — and its
comment states the intent: *"Orders still in transit to the PVZ or with the
seller keep listings full."*

The display has no such restriction. A brand-new `pending` order, and a
`PROCESSING` order the seller has not shipped, both reduce displayed stock —
while the engine deliberately leaves them out. The display over-subtracts
relative to the system's own definition, on the raw status the engine reads and
the display ignores.

---

## 3. Task 3 — the Yandex light refresh, and a correction to #311

**#311 §3.4 said the heavy pass has "a five-branch fallback with trimming" where
the light refresh has an exact lookup. That overstated the gap. Four of those
five branches are dead unless the whole stocks read failed.**

`lib/yandex/sync.ts:273`:

```ts
let campaignOfferStocks: Map<string, number> | null = null
if (stockMap.size === 0) {
  campaignOfferStocks = await fetchAllYandexCampaignOffers(token, campaignId)
}
```

`campaignOfferStocks` is fetched **only when `stockMap` is completely empty**. So
in the heavy chain at `:301-306`, branches 3 and 4 are `null`-guarded no-ops in
every normal run.

And in exactly that `stockMap.size === 0` case, the light refresh does not
silently diverge — `stock-refresh.ts:171-173` returns `{ ok: false }`, which
means the clock is **not** advanced (`cron/sync/route.ts:70-72`) and the next
tick retries. Clean failure, not a silent miss.

**The one live per-SKU divergence is `inlineStock`** (`sync.ts:305`), the FIT
count carried inline on the offer-mappings response. If `stockMap` is populated
overall but a given SKU's key is absent from it, the heavy pass falls through to
`inlineStock` and writes; the light refresh hits `next === undefined` at
`:180` and skips.

**Direction of the miss matters:** the light refresh *preserves the previous
value*. It is a strict subset of the heavy pass's sources, so:

> The light refresh can be **stale**, never **wrong**. It cannot write a zero
> the heavy pass would not also write.

That still produces a per-SKU "some update, some don't" pattern — but only for
SKUs missing from the stocks response, and it self-corrects on the next heavy
tick. It cannot produce a persistent floor the way §2 can.

**The trim asymmetry is real but narrow.** `products.sku` is normally
`skuOf(e.offer)`, trimmed at `sync.ts:233`, so light and heavy use an identical
key. Three order-derived paths write it **untrimmed** — `sync.ts:759`, `:829`
(`sku: it.offerId`) and `:1007` (`set({ sku: offerId })`, the title-match
backfill). A value written by one of those with stray whitespace misses in the
light refresh and is repaired by the next heavy pass, which rewrites `sku` from
the trimmed catalog value. Transient, and again stale-not-wrong.

**Ruling:** possibility 2 is not disproven, but it cannot explain a stock number
that never moves across many ticks, and it is not worth a branch until §2 is
excluded.

---

## 4. Task 4 — scope

**Uzum has no light-vs-heavy asymmetry at all.**

| | light (`stock-refresh.ts`) | heavy (`uzum/sync.ts`) |
| --- | --- | --- |
| endpoint | `fetchUzumShopProducts` (card) | `fetchUzumShopProducts` (card) |
| quantity | `uzumStockQuantity(sku)` `:84` | `uzumStockQuantity(sku)` `:299` |
| key written | — | `marketplace_product_id = String(sku.skuId)` `:288` |
| key read | `live.set(String(sku.skuId), …)` `:84` → `live.get(String(r.mpid))` `:108` | same |

Same endpoint, same function, same `String()` of the same numeric field on both
sides. No case exposure, no whitespace exposure, no fallback the light path
lacks. **Uzum is ruled out for possibility 2.**

Everything in §1 and §2 is marketplace-agnostic — one display path, one
`in_transit` term, both marketplaces on the same 30-day-ish window. Consistent
with the symptom appearing on Uzum *and* Yandex, which a Yandex-only join bug
could never explain.

---

## 5. Tasks 1 & 2 — what to run

There is **no database reachable from this session** (no `DATABASE_URL`, no
staging credentials; only `.env.example` is present). So, as the brief allows:
exactly what to run, for you to run.

All read-only. Run against prod; nothing below writes.

### Query A — Task 2, hand-compute the dashboard number

Reproduces `products.ts:41` and `:102` exactly. Replace the SKU list with the
articles you edited today.

```sql
SELECT s.marketplace,
       p.sku,
       p.stock_quantity,
       COALESCE(t.in_transit, 0)                                   AS in_transit,
       GREATEST(0, p.stock_quantity - COALESCE(t.in_transit, 0))   AS available_stock_shown
  FROM products p
  JOIN shops s ON s.id = p.shop_id
  LEFT JOIN (
        SELECT oi.product_id,
               SUM(oi.quantity) FILTER (
                 WHERE o.status IN ('pending','confirmed')
               ) AS in_transit
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
         GROUP BY oi.product_id
       ) t ON t.product_id = p.id
 WHERE s.user_id = '921b6a05-4414-4f1e-814b-42f21d5225d3'
   AND p.is_archived = false
   AND lower(p.sku) IN ('jmj16wh','jmj16bg','pbgry','kbblk')
 ORDER BY s.marketplace, p.sku;
```

**How to read it:**

- `stock_quantity` **already equals your marketplace edit** and
  `available_stock_shown` equals what the dashboard displayed →
  **possibility 1 confirmed, the write worked.** Go to Query B.
- `stock_quantity` does **not** reflect your edit → the write genuinely did not
  land; possibility 2 is back on the table and Query C applies.

### Query B — the decisive one: ghost reserved units

```sql
SELECT s.marketplace,
       o.status,
       o.marketplace_status,
       COUNT(*)                AS orders,
       SUM(oi.quantity)        AS units_subtracted,
       MIN(o.created_at)::date AS oldest,
       MAX(o.created_at)::date AS newest
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN shops s        ON s.id = o.shop_id
 WHERE s.user_id = '921b6a05-4414-4f1e-814b-42f21d5225d3'
   AND o.status IN ('pending','confirmed')
   AND o.created_at < now() - interval '30 days'
 GROUP BY 1, 2, 3
 ORDER BY units_subtracted DESC;
```

**Any row here is a permanently-stuck reserved unit** — outside the sync window,
so no future tick can ever clear it, and subtracting from displayed stock
forever. `units_subtracted` is how much the seller's visible stock is understated
by. `marketplace_status` tells you which of §2.3's three sources produced it
(`NULL` = pre-migration-054 rows; `PROCESSING`/`PICKUP`/`DELIVERY` = the
pre-#300 mis-map; `PENDING`/`UNPAID` = genuinely never progressed).

Empty result → §2 is not happening on this account, and the masking in Query A
is legitimate current orders.

### Query C — Task 1, the per-SKU triple, only if Query A shows a stale write

The brief asks for the raw-returned / written / in-transit triple on the next
tick. The first two are already logged but not per-SKU. In
`lib/marketplace/stock-refresh.ts`, inside the Yandex loop at `:176-183`,
temporarily log per row (**do not commit**):

```ts
logger.info('stock_refresh_probe', {
  shopId, sku: p.sku,
  rawKeyPresent: stockMap.has(p.sku),
  raw: stockMap.get(p.sku) ?? null,   // what YM returned
  stored: p.stock,                    // what we had
  wouldWrite: next,                   // what we're about to write
})
```

`rawKeyPresent: false` on a SKU that has stock on Yandex is the §3 divergence,
caught in the act. Pair it with the `in_transit` column from Query A for the
same SKU and you have the full triple.

Cheaper first pass, no code at all — compare what the refresh *claims* against
what changed:

```sql
SELECT id, name, marketplace, last_synced_at, stock_synced_at
  FROM shops
 WHERE user_id = '921b6a05-4414-4f1e-814b-42f21d5225d3';
```

If `stock_synced_at` is recent, the light refresh ran and returned `ok`. If it
is old or NULL while `last_synced_at` is recent, the shop is stuck permanently
`heavy` and the light refresh has never run for it (#311 §3.2).

---

## 6. Recommendation

**Do not write a stock-write fix.** §1, §3 and §4 all say the write path is
working; §3 in particular narrows the one asymmetry to stale-not-wrong.

**Run Query B first.** It is one read and it decides between "the display is
correctly subtracting real orders" (nothing to fix, explain it to the seller)
and "the display is subtracting orders that can never complete" (a real bug with
a clear shape).

If Query B returns rows, the branch-sized fix is on the **display**, not the
sync, and has three candidate shapes — to be chosen after seeing the data, not
before:

1. **Bound `in_transit` by the sync window.** Ignore `pending`/`confirmed` rows
   older than the lookback, since they can never be corrected. Smallest change;
   does not fix the underlying stale rows.
2. **Align the display with the engine.** Use `reservingOrderCondition()` in
   `products.ts` and `stock-groups.ts` so one definition of "reserved" governs
   both, and orders still with the seller stop reducing displayed stock (§2.4).
   Better, wider blast radius — it changes every stock number on the dashboard.
3. **Age out stuck orders at the source.** A one-time pass marking
   `pending`/`confirmed` rows older than the window as terminal. Fixes the data
   rather than hiding it, but it writes a status we did not observe, which is a
   real accuracy cost and needs the owner's call.

**Regardless of the verdict, the observability fix from #311 §5.1–5.2 is what
made Step 0 this expensive** — `products.updated_at` cannot report an update and
the refresh discards its `updated` count. Both are worth their own branch before
the next question of this shape arrives.

---

## 7. Tickets to open now (independent of the verdict)

Both carried over from #311 §5, unblocked by this pass:

1. **Cross-tenant write — `refreshUzumStock`.** `stock-refresh.ts:104` selects
   by `marketplace_product_id` with **no `shop_id` predicate**, in a function
   that takes `shopId` and logs it. The Yandex sibling scopes correctly at
   `:156`. Latent only because Uzum `skuId` is globally unique today. Two-line
   fix, real multi-tenant data-integrity bug, no dependency on anything above.
2. **Observability — persist "last actually changed".** `updated` is computed at
   `:111`/`:182`, logged at `:116`/`:186`, then discarded. Nothing in the
   database answers "when did this SKU's stock last move?" — which is the whole
   reason this investigation needed prod queries instead of a table lookup.

## 8. Not done, as instructed

- No stock fix written.
- `stock_sync_state` untouched and not compared to `products` — its rows are
  correct push records, and `stock-writer.ts:306-308` reads their `version` to
  suppress stale outbound writes.
- No marketplace API called.
