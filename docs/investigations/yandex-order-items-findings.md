# Yandex `order_items` — blank SKU/title, and a price that isn't the seller's

**Question:** why do Yandex `order_items` land with empty `sku`/`title` and a
price that doesn't match the marketplace, when Uzum's are correct?

**Status:** investigation only. No code, schema or config changed. Field names
and semantics below are quoted from Yandex's own OpenAPI spec
(`yandex-market/yandex-market-partner-api`), not from memory. Nothing was run
against prod — the row values are as reported in the brief.

Baseline: `main` @ `f8291ff`.

---

## Root cause — one sentence

**The Yandex order-item writer never populates `title`, `sku` or `variant_color`
— those three columns are absent from its row type, so they are never even
constructed, let alone inserted.** Uzum builds them via `uzumItemSnapshot()` and
writes all three.

This is not a mapping mistake (wrong field name on the right side). It is an
**omission**: the columns do not appear anywhere in the Yandex path.

The price is a **separate, unrelated defect** in the same statement — see §3.

---

## 1. Where it happens

There are **two** Yandex order-item writers, and *both* omit the snapshot
columns:

| | Row type | Inserts |
|---|---|---|
| `lib/yandex/sync.ts:905-908` (primary) | `{ order_id, product_id, quantity, price_per_unit }` | `:936-941` — same four |
| `lib/yandex/sync.ts:851` (product-extraction fallback) | same four | `:863-868` — same four |

The primary one:

```ts
// lib/yandex/sync.ts:905-908
const itemRows: {
  order_id: string; product_id: string | null;
  quantity: number; price_per_unit: number     // ← no title, no sku, no variant_color
}[] = []
```

```ts
// lib/yandex/sync.ts:936-941
await db.insert(orderItems).values(itmRows.slice(i, i + 500).map(r => ({
  order_id: r.order_id,
  product_id: r.product_id,
  quantity: r.quantity,
  price_per_unit: String(r.price_per_unit),
})))                                           // ← four columns, that's all
```

Against the working Uzum path:

```ts
// lib/uzum/sync.ts:1013-1021
await db.insert(orderItems).values(itemRows.slice(i, i + 500).map(r => ({
  order_id: r.order_id,
  product_id: r.product_id,
  quantity: r.quantity,
  price_per_unit: String(r.price_per_unit),
  title: r.title,                              // ← from uzumItemSnapshot()
  sku: r.sku,
  variant_color: r.variant_color,
})))
```

The columns exist and are nullable (`lib/db/schema.ts:302-304`), added precisely
so a line can name what was ordered when `product_id` never matched. Yandex just
never fills them.

**Why it looks worse than it is:** Yandex's `product_id` match is often fine
(`skuMap.get(offerId)`, with a title-match fallback at `:913-917`), so the
Products join usually still resolves a name in the UI. The blank columns bite
when that join misses — and they are what the CSV export and any product-less
listing read.

---

## 2. The DTO does carry what's needed — verified against the spec

From `OrderItemDTO.yaml`:

| Need | Field | Status |
|---|---|---|
| SKU | **`offerId`** — *«Идентификатор вашего товарного предложения»* | required, active |
| | ~~`shopSku`~~ | **deprecated, shutdown 2026-10-05** |
| Title | **`offerName`** — *«Название товара»* | required, active |
| Quantity | **`count`** | required, active |

So the fix is a straight read of two required fields that are **already in
scope** in the loop — `it.offerId` and `it.offerName` are used a few lines above
for the `product_id` match (`:911, :914`). The data is in hand and thrown away.

`variant_color` has no direct Yandex field; it would come from
`resolveColor(offerName)`, the same helper the product sync already uses.

---

## 3. The price — a different bug, and the brief's hypothesis needs correcting

```ts
// lib/yandex/sync.ts:924-929
price_per_unit: it.prices?.find(p => p.type === 'BUYER')?.costPerItem
  ?? it.prices?.find(p => p.type === 'PARTNER')?.costPerItem
  ?? it.buyerPrice
  ?? it.price
  ?? 0,
```

### 3a. The first two fallbacks are dead code

**`OrderItemDTO` has no `prices` array.** Its price fields are exactly `price`,
`buyerPrice`, `buyerPriceBeforeDiscount`, and the deprecated
`priceBeforeDiscount`. There is no `prices[]`, no `costPerItem`, no `BUYER`/
`PARTNER` type discriminator anywhere in the schema.

`prices` and `initialPrice` are declared on our own interface
(`lib/yandex/client.ts:81-85`) with the comment *"Some YM endpoints return price
at the item level (flat), others nest it under prices"* — that belief is not
supported by the current spec. Those two lookups **always** evaluate to
`undefined`, so the effective expression is:

```ts
price_per_unit = it.buyerPrice ?? it.price ?? 0
```

The second writer (`:851`) skips the dead branches and reads `it.buyerPrice ??
it.price ?? 0` directly — same effective behaviour, which is why both produce
the same number.

### 3b. Why 80 000 instead of 100 000

`buyerPrice` is *«Цена товара в валюте покупателя. В цене уже учтены скидки по:
акциям; купонам; промокодам»* — **what the buyer paid after discounts**.

`price` is *«Цена товара… без учета вознаграждения продавцу за скидки по
промокодам, купонам и акциям»* — the order-currency price, excluding the
compensation Yandex pays the seller for those discounts.

So for a promo-discounted item the buyer pays less than the seller receives;
Yandex makes up the difference through `subsidies`. Storing `buyerPrice`
therefore **understates seller revenue by exactly the subsidy**.

The reported numbers fit that precisely — and, usefully, they fit *differentially*:

| Order | Yandex UI | Stored | |
|---|---|---|---|
| `60797292099` | 100 000 | **80 000** | 20% gap — a discounted item |
| `60767668482` | 115 000 | **115 000** | ✅ matches — no discount |

**An order with a discount mismatches; an order without one matches exactly.**
That is the signature of a discount/subsidy gap, not of a broken read.

**This corrects the brief's hypothesis.** The suspicion was that "several orders
all 115000" hinted at a flat or shipment-derived figure. It doesn't — 115 000 is
simply the powerbank's price, and repeat orders of one product legitimately share
it. The price *is* read per item; it is just the **wrong one of two real per-item
prices**.

`subsidies` is never read anywhere in the codebase (`grep -rn "subsid" lib/`
returns nothing), so the compensation half is currently invisible.

### 3c. The order-level `revenue` has the same shape, plus a deadline

```ts
// lib/yandex/sync.ts:532
revenue: o.buyerTotal ?? o.itemsTotal ?? 0
```

`buyerTotal` is *«Стоимость всех товаров… после применения скидок и с учетом
стоимости доставки»* — after discounts **and including delivery**. Two problems:

1. It folds shipping into revenue.
2. **It is deprecated with a shutdown date of 2026-10-05** — about six weeks
   from today (2026-08-24).

When it goes, `?? itemsTotal` catches the fall gracefully — no crash — but every
Yandex order's revenue **silently changes value** (delivery no longer included)
on whichever sync tick that happens. That is a worse failure than an error,
because nothing announces it.

`itemsTotal` (*«Платеж покупателя»*) is the active field.

### 3d. Other deprecations on the same 2026-10-05 date

`shopSku`, `buyerItemsTotal`, `buyerTotalBeforeDiscount`, item
`priceBeforeDiscount`, and `subsidy` (→ `subsidies`). Worth one sweep rather than
five surprises. Only `buyerTotal` is currently load-bearing for us.

---

## 4. Is it one fix or several?

**Three separable concerns, deliberately not one branch:**

| | Concern | Risk | Decision needed? |
|---|---|---|---|
| **A** | `title` / `sku` / `variant_color` never written | none — filling always-NULL columns | no |
| **B** | `price_per_unit` reads `buyerPrice` instead of the seller's price | changes stored money | **yes** |
| **C** | `revenue` reads deprecated `buyerTotal` | changes stored money + hard deadline | **yes** |

A is purely additive and provably safe. B and C both **restate money already
shown to the seller** and feed P&L, KPIs and the turnover that drives the
recommended tier. They should not ride along with A.

---

## 5. Fix plan

### Branch 1 — `fix/yandex-order-item-snapshot` 🟢 do first
Populate `title` (`it.offerName`), `sku` (`it.offerId`) and `variant_color`
(`resolveColor(it.offerName)`) in **both** writers. Mirror `uzumItemSnapshot()`
so the two paths read alike.
**Files:** `lib/yandex/sync.ts:851-868`, `:905-941`.
**Risk:** minimal — these columns are 100% NULL for Yandex today, so nothing can
regress. No money value changes.
**Verifiable from code:** ✅ fully.

### Branch 2 — `fix/yandex-item-price-source` 🟠 needs a decision
Decide what `price_per_unit` should mean for a seller-facing analytics product,
then read it consistently:
- `buyerPrice` — what the buyer paid *(today's behaviour)*
- `price` — order-currency price excluding promo compensation
- `price` (or `buyerPrice`) **+ the matching `subsidies` entry** — closest to what
  the seller actually earns

Note the codebase already treats settlement data as authoritative for fees
(`lib/db/real-financials.ts`), so the cleanest answer may be "order-time price is
an estimate; settlement is truth" — consistent with how commission is handled.
**Risk:** medium — restates revenue on the Payouts/P&L surfaces.
**Blocked on:** one live order payload showing `price`, `buyerPrice` and
`subsidies` side by side. `60797292099` is the ideal specimen (it has the gap).

### Branch 3 — `fix/yandex-deprecated-order-fields` 🟠 has a deadline
Move `revenue` off `buyerTotal` before **2026-10-05**, and decide deliberately
whether revenue should include delivery (it does today, via that field). Sweep
the other five deprecated fields in the same pass.
**Risk:** medium, same surfaces as Branch 2 — worth sequencing right after it so
the money definition is settled once.

### Also worth flagging
Delete `prices` and `initialPrice` from `YandexOrderItem`
(`lib/yandex/client.ts:81-85`) and the comment justifying them. They describe an
API shape that does not exist; leaving them invites the next person to "fix" the
mapping by feeding them.

---

## 6. Backfill — mostly not needed

**The order-items writer already deletes and re-inserts**
(`lib/yandex/sync.ts:934`: `db.delete(orderItems).where(inArray(order_id, …))`
then re-insert) for every order in the fetch window. That window is the rolling
**30-day** `ORDER_STATUS_LOOKBACK_DAYS` (`:458`).

So after Branch 1 ships, **every Yandex order created in the last 30 days
repairs itself on the next heavy sync** — no backfill script required.

Two caveats:
- It runs on the **heavy** pass only, which is plan-throttled (free 6 h, pro 2 h,
  pro_plus 30 min) — so allow up to a plan interval, not 5 minutes.
- Orders **older than 30 days** are never re-fetched and stay blank forever. All
  6 known Yandex orders are from August 2026, so at time of writing they are all
  inside the window and self-heal. If that stops being true, a one-off backfill
  would need the orders re-fetched with a wider `fromDateOverride` — which
  `syncFromYandex` already accepts as a parameter.

**Recommendation:** ship Branch 1, wait one heavy pass, re-run the check query.
Only write a backfill if rows outside the window turn out to matter.

```sql
-- after Branch 1 + one heavy sync
SELECT o.order_id_external, oi.sku, oi.title, oi.price_per_unit
FROM order_items oi JOIN orders o ON o.id = oi.order_id
WHERE o.marketplace = 'yandex_market'
ORDER BY o.ordered_at DESC;
```

---

## 7. Out of scope, as briefed

Uzum item sync (reference only — it is correct), the alert gate, `STATUS_MAP`,
and the shop-identity work. No code was changed in this pass.
