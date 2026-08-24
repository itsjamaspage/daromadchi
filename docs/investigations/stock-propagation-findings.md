# Investigation — marketplace stock not reaching `products.stock_quantity`

**Status:** investigation only. No code changed in this pass.
**Date:** 2026-08-24
**Scope:** the inbound stock READ path (marketplace → `products.stock_quantity`).
The outbound push (`stock_write_log`, opt-in) is out of scope and did not turn
out to share a write function with the read path.

---

## 0. Headline

**There is no missing propagation from `stock_sync_state.last_available` to
`products.stock_quantity`, because no such propagation was ever intended.**

The two columns are written by two unrelated subsystems, from two different
sources, on two different schedules, and they hold two different *kinds* of
number. Neither reads the other. A row where they disagree is not evidence of a
dropped write.

The brief's premise — "the refresh updates `last_available` but doesn't
consistently write that into `products.stock_quantity`" — is inverted:

| | writes `products.stock_quantity` | writes `stock_sync_state.last_available` |
| --- | --- | --- |
| **stock refresh** (`lib/marketplace/stock-refresh.ts`) | **yes** — `:110`, `:181` | never (does not import `stockSyncState`) |
| **stock sync / push** (`lib/marketplace/stock-sync.ts`) | only after a *successful outbound push* — `:520` | **yes** — `bumpVersion()`, `:262` |

`bumpVersion()` is the **only** writer of `stock_sync_state` in the entire
codebase (verified by grep: `stockSyncState` appears in exactly two files, and
`stock-writer.ts` only *reads* it). Its own doc comment at `stock-sync.ts:256`
says it: *"Called once per real write, before pushing."*

So the direction of dependency is the reverse of the brief's: `products` is the
**input** to `last_available`, not its output.

**And the supporting evidence for "products rows are frozen" does not say that
— see §2. That is the finding I would act on first.**

---

## 1. What `last_available` actually is

Three facts, each of which independently breaks the comparison in the brief's
evidence table.

### 1.1 It is a derived number, not a marketplace reading

`stock-sync.ts:408` → `planStockWrites(group.members, oversellMode)` returns
`available`, computed as the file header (`:4-5`) states:

```
available = max(0, MAX(stock across the group) − SUM(all pending across the group))
```

`last_available` is **stock minus reserved units**. `products.stock_quantity` is
**stock**. They are *supposed* to differ by exactly the pending count. A group
with one reserving order and a stock of 2 will show `last_available = 1` against
`stock_quantity = 2` forever, and both are correct.

Check the brief's own table against this:

| sku | `last_available` | `stock_quantity` | difference | reading |
| --- | --- | --- | --- | --- |
| `jmj16wh` | 2 | 1 | −1 | ⚠️ see §1.4 |
| `jmj16bg` | 1 | 0 | −1 | ⚠️ see §1.4 |
| `pbgry` | 0 | 2 | +2 | consistent with 2 pending units |
| `kbblk` | 1 | 1 | 0 | consistent with 0 pending |

`pbgry` and `kbblk` — two of the four rows, including the one flagged ❌ — are
exactly what a correct system produces. They are not mismatches.

### 1.2 It is per-GROUP, not per-product

`stock_sync_state.sku` is not a product SKU. It is `matchKey` — the output of
`normalizeKey()` at `stock-sync.ts:41-43`:

```ts
function normalizeKey(sku: string): string {
  return sku.trim().toLowerCase().replace(/[\s\-_./]+/g, '')
}
```

applied at `:173`. One row covers **every product across every shop** that
normalizes to the same key. The unique index is `(shop_id, sku)`
(`schema.ts:931`), so one row per shop per *group*, not per listing.

A seller with the same article on Uzum and Yandex has one group with two
members; `last_available` is the shared pool for both. Comparing it to a single
member's `stock_quantity` compares a group aggregate to one of its inputs.

### 1.3 It only exists for opted-in shops, and only after a planned write

`stock-sync.ts:385`:

```ts
const writableMembers = group.members.filter(m => m.apiMode === 'stock_sync')
if (writableMembers.length === 0) continue // Step A only (display), no writes
```

A `read_only` shop — the default for every shop until its owner opts in — never
reaches `bumpVersion()`. And within an opted-in shop, `bumpVersion()` is called
at `:480` inside the `for (const plan of toWrite)` loop, so a group with nothing
to push writes nothing.

### 1.4 This directly answers Task 2 and Task 3

**Task 2 ("what condition gates the products write?" / "the `updated_at` spread
suggests event-driven").** The spread is real and the inference about it is
right — but it is a property of `stock_sync_state.updated_at`, not of `products`.
`bumpVersion()` sets `updated_at: now` (`:264`, `:267`) only on a planned push.
So `ss.updated_at` is precisely *"when this group last had a stock write pushed
to the marketplace"*. Aug 8 / 14 / 18 / 20 / 24 is a log of five push events. It
is event-driven **by design**, and it is not a gate on anything in `products`.

That is also what makes `kbblk` look "healthy": it isn't more propagated than
the others, it is simply the group that was pushed most recently (today), so its
snapshot of `available` hasn't had time to drift from current stock. `jmj16wh`'s
`last_available = 2` is a **stale snapshot from Aug 20**, not a live reading —
it says "on Aug 20 this group's available was 2". Stock has since moved to 1.
Nothing is wrong; the row is a historical record and is behaving like one.

**Task 3 ("case sensitivity — does it join on `product_id` or `sku`?").** The
case difference is real and correctly spotted: `stock_sync_state.sku` is
lowercase because `normalizeKey()` lowercases it. But it **cannot** be dropping
writes, because no propagation joins these two tables at all. `stock_sync_state`
does carry a `product_id` column, and `bumpVersion()` writes it (`:263`) — but
it is a *breadcrumb* recording which member drove the write, not a join key.

The case mismatch is a hazard for **manual SQL** — including the query that
produced the brief's evidence table — not for the application.

---

## 2. The actual symptom, and why the evidence for it does not hold

Set `stock_sync_state` aside. The real report is: **a manual stock edit on the
marketplace does not appear on the dashboard.** The brief's evidence for that is:

> `products.stock_quantity` rows are frozen — newest `updated_at` is Aug 17.

**That statement cannot be concluded from that data.**

`products.updated_at` is declared at `schema.ts:243`:

```ts
updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
```

`defaultNow()` fires **on INSERT only**. Postgres has no automatic
`ON UPDATE` for timestamps, and there is **no trigger** on this table — I grepped
every migration for `CREATE TRIGGER` / `FOR EACH ROW` and there are none (the
only `CREATE OR REPLACE FUNCTION` hits are four read-only reporting RPCs in
`019_*` and `020_*`).

Then I checked all **16** `db.update(products)` call sites in the codebase:

```
app/api/products/physical-stock/route.ts:26      lib/uzum/sync.ts:352, 398, 756, 832
app/api/products/update/route.ts:26              lib/yandex/sync.ts:391, 422, 807, 869, 1007
lib/marketplace/stock-sync.ts:520                lib/marketplace/identifier-backfill.ts:115, 151
lib/marketplace/stock-refresh.ts:110, 181
```

**Not one of them sets `updated_at`.** It is structurally impossible for that
column to advance on an update.

So `MAX(products.updated_at) = Aug 17` means exactly one thing: **no new product
row has been inserted since Aug 17.** For a stable catalogue that is the
expected reading. It says nothing whatsoever about whether `stock_quantity` is
moving — the refresh at `stock-refresh.ts:110` and `:181` could be firing every
15 minutes and that column would still read Aug 17 forever.

**Before any fix is designed, this needs a measurement that actually measures
the thing** (§5, step 0). Everything downstream of "products are frozen" is
currently resting on a column that cannot report it.

---

## 3. The paths that *do* write `stock_quantity`, and their real failure modes

Both are live and both write. Ranked by how likely each is to be the true cause,
given that §2 removes the only evidence we had.

### 3.1 The display is `available`, not `stock` — the leading candidate

`lib/db/products.ts:102`:

```ts
const availableStock = Math.max(0, p.stock_quantity - dbInTransit)
```

and it is returned as `available_stock` (`:121`) alongside the raw
`stock_quantity` (`:114`). If the dashboard column the seller is looking at is
`available_stock`, then **a manual restock is masked, unit for unit, by
in-transit orders** — and the number legitimately does not move when they
restock by the same amount they just sold.

This would produce the reported symptom with every write working perfectly. It
should be ruled out before anything is changed, and it is the cheapest check in
this document.

Note this is the same `max(0, stock − pending)` shape as `last_available`
(§1.1) — computed independently, in a different file, for the display.

### 3.2 The refresh is skipped entirely on a heavy tick

`app/api/cron/sync/route.ts:62`:

```ts
if (stockDue && !heavy) {
```

The stock refresh does not run when the tick is heavy — reasonably, since the
heavy pass re-reads the same quantities (`yandex/sync.ts:301`, `uzum/sync.ts:761`)
and both do write `stock_quantity`.

But `heavy` is derived from `last_synced_at` (`:176`), and `last_synced_at` only
advances when `criticalOk` is true (`yandex/sync.ts` sync-metadata block). **A
shop whose product sync is persistently degraded is therefore permanently
`heavy`** → the light refresh never runs for it → and the heavy pass it's
falling back on is the one that's failing. Both stock paths are then dead at
once, and `stock_synced_at` never advances either, because the clock is inside
the `if (stockDue && !heavy)` block.

Checkable directly: `last_synced_at` vs `stock_synced_at` per shop. The brief
says `stock_synced_at` advanced to 20:45 today, which *rules this out for at
least one shop* — but the brief covers several, and this needs to be confirmed
per shop rather than in aggregate.

### 3.3 Two clocks — confirmed, as Task 4 suspected

`app/api/cron/sync/route.ts:72` advances `stock_synced_at` on `sr?.ok` alone.
`ok` is returned with `updated: 0` on at least two no-op paths:

- `stock-refresh.ts:97` — `live.size === 0` → `{ ok: true, seen: 0, updated: 0 }`
- `stock-refresh.ts:158` — no SKUs on the shop → `{ ok: true, seen: 0, updated: 0 }`

So yes: **the clock can advance, and the tick be reported as a success, while
zero product rows were written.** Same shape as the alert-gate clock issue.

It is not *wrong* — an unchanged catalogue must also be `ok`, or the refresh
would retry forever — but it means `stock_synced_at` answers "did a read
succeed?", never "did anything propagate?". The `updated` count is computed
(`:111`, `:182`) and logged (`:116`, `:186`), then **discarded**: it is not
persisted anywhere, so there is no stored answer to "when did this shop last
have a stock value actually change?". That gap is why §2's question can't be
answered from the database today.

### 3.4 Yandex: the refresh join is stricter than the heavy pass

`stock-refresh.ts:178` — `stockMap.get(p.sku)` — is an exact, case-sensitive,
untrimmed lookup. The map's keys come from `yandex/client.ts:656` and `:665`
(`item.sku ?? item.offerId`, `off.offerId`) raw off the wire, also untrimmed.

The heavy pass is more forgiving. `yandex/sync.ts:301-305` tries `shopSku` (which
went through `skuOf()`, and **is** trimmed — `:230-233`), then `marketSku`, then
two `campaignOfferStocks` lookups, then an inline value.

So a SKU with stray whitespace, or a `products.sku` written by a path that
didn't trim, resolves on the heavy pass and silently misses on the light one —
`next === undefined` → `continue` at `:180`, no log, no counter. This is
consistent with **some** SKUs propagating and others not, which is the pattern
the brief describes.

The `:135-137` comment records a live probe hitting 8/8 on `shopSku`, so this is
a hazard rather than a demonstrated failure — but that probe was a point-in-time
check of one account.

### 3.5 Uzum: the refresh is not scoped to a shop *(separate bug, found en route)*

`stock-refresh.ts:102-104`:

```ts
const rows = await db.select({ ... })
  .from(products).where(inArray(products.marketplace_product_id, ids))
```

**No `shop_id` predicate.** `refreshUzumStock(shopId, …)` takes a `shopId`,
logs it (`:116`), and never filters on it. Every product row in the entire
`products` table whose `marketplace_product_id` matches a returned `skuId` is
updated — across users.

The Yandex sibling gets this right: `:156` is scoped
`.where(eq(products.shop_id, shopId))`.

Today this is probably latent — Uzum `skuId` is globally unique, so a collision
needs two sellers with the same `skuId`, i.e. the same listing. It is still a
cross-tenant write with no tenant predicate, one shared-SKU edge case away from
one seller's refresh overwriting another's stock. **Not the cause of the
reported symptom; fix it anyway**, and note it is the same class of mistake as
`shops/deactivate/route.ts:51`, which deliberately puts ownership *in the WHERE
clause* rather than in a prior read.

---

## 4. Task 5 — scope

**Shared, not Yandex-only** — but the two marketplaces share the *architecture*,
not a function.

- §1 (the `last_available` mis-reading) is **fully shared** — `stock-sync.ts` and
  `bumpVersion()` are marketplace-agnostic, which is why the brief's evidence
  shows the identical pattern on both. Both marketplaces "failing the same way"
  is expected, and is itself a hint that the comparison, not the code, is what's
  common.
- §2 (`updated_at` insert-only) is **fully shared** — one column, one schema.
- §3.1 (display shows `available`) is **fully shared** — one read path.
- §3.2 and §3.3 are **fully shared** — one cron.
- §3.4 is **Yandex-only** (Uzum joins on `marketplace_product_id`, an exact
  numeric-string `skuId` set by `uzum/sync.ts:288` and read back at `:84` — no
  case or whitespace exposure).
- §3.5 is **Uzum-only**.

---

## 5. Fix plan

**Step 0 is not optional.** §2 removed the evidence that a propagation bug
exists. Building the fix before re-measuring risks changing working code to
chase a symptom that is actually §3.1.

### Step 0 — measure the thing (no code, ~10 minutes)

Read-only. Two questions:

1. **Is `stock_quantity` actually stale?** Compare it against the marketplace's
   own UI for two or three named SKUs, or re-run the refresh and diff the column
   before/after. `updated_at` cannot answer this and neither can
   `stock_sync_state`.
2. **Is the dashboard showing `available_stock` or `stock_quantity`?** Read the
   column binding in `components/dashboard/ProductsTable.tsx` and compare to
   `p.stock_quantity - in_transit` for one SKU the seller says is wrong.

If (1) says stock is current and (2) says the display is `available_stock`,
**there is no propagation bug** and the branch below shrinks to §5.2 + §5.3.

### 5.1 — `products.updated_at` must mean something *(prerequisite)*

Add `updated_at: new Date()` to the `.set({...})` of all 16 writers, or add a
Postgres `ON UPDATE` trigger and drop the question entirely. The trigger is
better: it cannot be forgotten by the 17th writer.

Do this **first**, on its own, even if everything else is dropped. Without it,
neither this investigation nor the next one can tell a stale row from a quiet
one — which is the position we are in right now.

### 5.2 — persist "last actual change" *(the observability gap in §3.3)*

`updated` is already computed and logged, then thrown away. Persist it: either a
`shops.stock_changed_at` advanced only when `updated > 0`, or a per-shop counter
on the existing sync-day row. Keep `stock_synced_at` as-is — "a read succeeded"
is a genuinely different fact from "something moved", and conflating them is how
§3.3 became invisible.

### 5.3 — scope the Uzum refresh to its shop *(§3.5, independent)*

Add `eq(products.shop_id, shopId)` to `stock-refresh.ts:104`, matching the
Yandex sibling at `:156`. Two lines, no behaviour change for single-tenant SKUs,
closes a cross-tenant write. Worth doing regardless of everything above.

### 5.4 — align the Yandex refresh join with the heavy pass *(§3.4, conditional)*

Only if Step 0 confirms some Yandex SKUs are genuinely stale. Give
`refreshYandexStock` the same tolerance the heavy pass has — trim both sides,
fall back to `market_sku`/`marketplace_product_id` — and **count the misses**
(`sku present, no stock key`) into the log line, so a silent `continue` at `:180`
stops being silent.

### 5.5 — not in this branch

The `if (stockDue && !heavy)` interaction (§3.2) touches sync scheduling and the
degraded-shop path. If Step 0 implicates it, it is its own ticket.

---

## 6. Self-heal vs. reconcile

**Existing stale rows self-heal; no backfill script is needed.**

Both stock writers are unconditional overwrites of the current value — not
deltas, not fill-if-null. The refresh compares and writes on any difference
(`:109-111`, `:180-182`), and the heavy pass overwrites whenever the API reported
a number (`yandex/sync.ts:383`). The next successful tick after a fix converges
every row it can see.

Three exceptions, in ascending order of importance:

1. **§5.1 changes nothing retroactively.** Existing rows keep their insert-time
   `updated_at` until each is next updated. The column becomes trustworthy
   going forward only — worth stating so nobody reads Aug 17 as meaningful a
   second time.
2. **Absent ≠ zero, deliberately** (`stock-refresh.ts:22-24`, `:179`). A SKU the
   marketplace stops returning keeps its last value indefinitely. A row stale
   for that reason will *not* self-heal, because that is the intended
   behaviour — the alternative zeroes a catalogue on a paging hiccup.
3. **Nothing needs reconciling in `stock_sync_state`.** Its rows are correct
   historical push records (§1.4). Do not "repair" them to match `products`:
   that would destroy the version/dedup state `stock-writer.ts:306-308` reads to
   suppress stale writes, and it is the one table here whose contents gate an
   outbound marketplace write.

---

## 7. Summary

**Root cause (one statement):** `stock_sync_state.last_available` does not reach
`products.stock_quantity` because it is a per-*group* snapshot of *available
after pending*, written only when an opted-in shop pushes stock **to** a
marketplace — the opposite direction from the refresh, which reads **from** the
marketplace straight into `products` and never touches `stock_sync_state`. It is
neither a missing write, a conditional gate, nor a case-sensitive join.

**Primary file:lines:** `lib/marketplace/stock-sync.ts:256-270` (`bumpVersion`,
the sole writer), `:385` (the opt-in gate), `:408` (`available` is derived);
`lib/marketplace/stock-refresh.ts:110` and `:181` (the real `products` writers).

**The finding that changes what to do next:** `products.updated_at` is
insert-only — `schema.ts:243`, no trigger in any migration, and none of the 16
`db.update(products)` sites sets it. "Newest `updated_at` is Aug 17" means "no
product inserted since Aug 17", not "stock is frozen". The strongest remaining
explanation for the reported symptom is that the dashboard shows
`available_stock = max(0, stock_quantity − in_transit)` (`lib/db/products.ts:102`),
in which a restock is masked by in-transit orders — with a real Yandex join
hazard (§3.4) as the alternative. **Step 0 separates them in about ten minutes,
and should run before any code changes.**

**Found en route, unrelated to the symptom:** `refreshUzumStock` updates
`products` with no `shop_id` predicate (`stock-refresh.ts:104`) — a cross-tenant
write. Fix regardless.
