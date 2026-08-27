# Proposal: event-sourced physical-stock ledger (activation)

Status: **agreed design, pre-implementation.** Owner-agreed in review; amendments folded in below.

## Problem

`products.physical_stock` (the shared-pool source for `computeAvailable`) is inferred from the marketplace listing, and the listing carries **one number with two meanings** — "what the seller has" and "what the marketplace decremented for an order." No value-comparison rule can separate them:

- A marketplace **order-decrement** (after we push `available`, the marketplace nets the same accepted order off its listing again) looks like a seller change and collapses the pool — the **KBWHT 2→1→0 ratchet**.
- The `fix/reconcile-order-decrement-stopgap` (#389) adds a `pending`-aware band that stops the ratchet, but it **cannot** close two cases: a genuine seller reduction while an order is open (silently ignored), and a marketplace restore-on-cancel (adopted as a restock, ratchets up). Those are why this ledger exists.

The fix is to **track the events instead of inferring them from the value.** `on_hand = Σ delta` over an append-only ledger.

## What already exists (do not reinvent)

- **Table** `stock_ledger(user_id, match_key, delta, reason, order_id_external, created_at)`, unique on `(user_id, match_key, reason, order_id_external)` → idempotent appends (migration 065).
- **Pure module** `lib/marketplace/stock-ledger.ts` (#172): `ledgerOnHand = Σδ`, `availableFromOnHand = max(0, onHand)`, `diffLedger(orders, recordedKeys)` (consume/cancel/return rules), `ledgerKey` (dedup).
- **`computeAvailable(members, onHand)`** already returns `max(0, onHand)` when `onHand` is supplied — it is simply **never fed** (`planStockWrites` is called without it).

So implementation = **three wires**: (1) load a group's recorded events, (2) `diffLedger` → append new events, (3) pass `ledgerOnHand` as `onHand`. Everything below is *how* we do that safely, per seller.

## Locked model (from #172, unchanged)

- **Option A — debit at PLACEMENT**, anchored to the new-order detection that already works (not a handover/delivered transition, the kind that gets missed). Reservation and debit are the same event → no separate `pending` term: `available = max(0, on_hand)`.
- **Missed credit → undersell, never oversell.** A cancel/return we fail to catch leaves `on_hand` too low. That asymmetry is why Option A wins.
- **Returns credit only when the unit re-enters sellable stock** (`restockable`).
- **Seed is seller-confirmed.**

## Activation decisions

### 1. Seeding existing shops
`physical_stock` is corrupted, so it cannot seed the ledger. One `reason='seed'` event per linked group, from a **seller-confirmed** number. A group with no seed event has **no ledger** and falls back to the legacy `MAX − pending` path (+ the #389 stopgap). Seeding is **opt-in per seller, per group** — nothing flips silently.

**Seeding UI (amended — do NOT prefill).** The "MAX listing across the group" number is the corrupted one; defaulting to it invites the seller to click through and seed the corruption *permanently* into the ledger, where it is harder to spot than in `physical_stock`. So:
- The seller must **type a number**. No prefill.
- The MAX-listing figure may be shown only as **unlabeled reference context**, never as a default value in the field.

### 2. Orders open at seed time — **S1 (chosen)**
The seller confirms **free-to-sell right now** ("how many can I still sell"). `on_hand := that`. We write a no-op `consume` **key** (dedup marker, no delta) for every currently-open order so `diffLedger` will not debit them again.

- Consequence: a **pre-seed** order cancelling does **not** auto-credit (no delta to reverse) → undersell-safe, and drains as pre-seed orders close out.
- Rejected S2 (seed total + retroactively consume opens): more correct on pre-seed cancels, but requires the seller to count "total incl. committed" (harder) and carries retroactive consumes. S1's only downside is undersell-safe and transient.

### 3. Per-seller rollout order (amended — rank by blast radius, not corruption severity)
The ledger is per-seller (a group spans their shops). Rollout is per seller, **shadow-first** (§5), in this order:

1. **Owner's own account** (the KBWHT seller) — dogfood.
2. **read-only sellers** — a wrong `on_hand` is only a wrong number on a screen.
3. **`stock_sync` (edit-mode) sellers — LAST.** A wrong `on_hand` here gets **pushed to the marketplace**. The group most in need of the fix is also the one where a bad flip does real damage, so it goes last, after the mechanism is proven on the lower-blast-radius tiers.

### 4. What `reconcilePhysicalStock` becomes
- **Ledger'd group** (has a seed event): `on_hand` is authoritative; reconcile **skips** it. `physical_stock` is no longer the pool source there.
- **Not-yet-seeded group**: the #389 stopgap reconcile still runs. The two coexist because `computeAvailable` prefers `onHand` when present and falls back otherwise.
- **End state**: once all of a seller's groups are ledger'd, reconcile does nothing for them; once *all* sellers are migrated, `reconcilePhysicalStock` is removed and `physical_stock` is dropped or demoted to a display-only mirror.

### 5. Shadow-mode validation gate (amended — gate on events observed, not elapsed time)
For each seller, before the ledger drives anything: on every sync compute **both** availables — legacy (`MAX physical − pending`, + stopgap) and ledger (`ledgerOnHand`) — and log `{group, legacyAvail, ledgerOnHand, diff}` **without** using the ledger for writes or display.

A seller is **not** flipped to `onHand`-authoritative until their shadow log has actually **covered all of**:
- at least **one cancellation**,
- at least **one seller-initiated restock**,
- at least **one order open across a sync boundary**.

Two quiet weeks prove nothing; a busy three days may prove everything. Length is "whatever it takes to see those." Keep the **divergence spot-audit** unchanged: sample the cases where the two availables disagree and confirm the ledger is the correct one against the seller's real shelf; **zero** cases where the ledger is the wrong one.

## Consistency flags (both accepted)

1. **`live` is anchored to `RESERVING_RAW_STATUSES`, not the stale `pending|confirmed|delivered` comment.** Consume must fire on the same paid-and-committed gate as reserve-at-payment (#347), or unpaid Uzum drafts debit the pool and reintroduce the phantom-stockout that #347 fixed. `GroupOrder.status='live'` is derived from that gate.
2. **`restockable` defaults to `false`** (undersell-safe) until it can be sourced from the marketplace, and the resulting under-credit on restockable returns is a **documented known gap**, revisited when the data is available.

## Idempotency

`diffLedger` + `ledgerKey` + the unique index `(user_id, match_key, reason, order_id_external)` make event insertion idempotent across re-syncs and restarts: a `(reason, order)` already recorded is never re-emitted, so a re-sync is a no-op.

## Implementation increments (each its own PR, shadow-safe)

1. **Status mapping + shadow evaluator (no behaviour change).** Derive `GroupOrder.status` from `RESERVING_RAW_STATUSES` (`live`) / `cancelled` / `returned`; load recorded events per group; `diffLedger` → append; compute `ledgerOnHand`; log the legacy-vs-ledger comparison. Gated OFF; does **not** feed `computeAvailable`. Seed writer for dogfood.
2. **Seeding flow** (seller-confirmed, no prefill) + the per-group "is this group ledger'd?" gate that makes `reconcilePhysicalStock` skip seeded groups.
3. **Per-seller flip** to `onHand`-authoritative, gated on the §5 event-coverage check, starting with the owner, then read-only, then `stock_sync`.
4. **Retirement**: remove the stopgap reconcile for migrated sellers; eventually drop `physical_stock`.

The read-only **cancel-restore alert (#388)** stays gated OFF until a seller is shadow-validated and flipped — it inherits `on_hand`, not the stopgap.

## Regression cases (from prod — must be tests before the ledger is authoritative)

### JMBLK — a cancellation permanently cost a unit of pool (the originally reported bug)
Uzum, `stock_sync`, confirmed on real data:

| time (2026) | event |
|---|---|
| Aug 25 21:09 | order `124456232` created, qty 1 |
| Aug 25 21:20 | we pushed **2** |
| Aug 26 12:50 | order **CANCELED** — we pushed **1**, not back up to 2 |

Result: `physical_stock` for JMBLK is now **uzum=1 / yandex=2**. The Uzum row was adopted **down** off the decremented listing and never recovered — a cancelled order permanently cost a unit of pool. This is exactly the class the #389 stopgap **cannot** close (a restore-on-cancel is an upward move, adopted as a restock; and the down-adoption already happened).

**Ledger requirement:** with the JMBLK group on the ledger, `seed 2 → consume(124456232) −1 → cancel(124456232) +1` must return `on_hand` to **2**, and neither the down-adoption nor the failure-to-recover can occur (the value of the listing never feeds the pool). Add as a ledger regression test.

## Post-merge verification for the #389 stopgap (prod, before building the shadow evaluator)

Run on real data using SKUs with known-good manual corrections (`KBWHT` physical_stock=2, `KBBLK`=2):
- [ ] `physical_stock` **holds** across multiple sync passes with an order open (the ratchet is stopped).
- [ ] a **genuine seller restock** is still adopted — raise stock in the marketplace UI, verify it propagates to `physical_stock`.
- [ ] a **drop beyond pending** is still adopted.

The shadow evaluator (increment 2) is deliberately **held** until #389 has run in prod for several days: once it lands, "legacy" in the shadow comparison means the *stopgap's* behaviour, so the comparator must be built against a **stable** legacy, not one that's about to move.

## Open unknown: does a marketplace self-restore on cancellation?
It **cannot be answered from our data** — `stock_write_log` records only our writes, and `products.stock_quantity` keeps no history. Treat it as **unknown**. The cancel-restore alert's INFO branch (#388) is already observation-driven — it fires only when a restore is actually observed (`after >= before`) and does nothing if restores never happen — so it is correct either way. Do not build any ledger/alert logic that *assumes* a self-restore; wait for a live cancellation to be observed to settle it.

## Every consumer of the pool — read the ledger, not the mirror

When on_hand becomes authoritative, **all** of these must read it. The display path
was silently a THIRD consumer of pool data — the KBWHT/JMBLK/PBGRY "shows 0 with a
sellable unit" bug (Aug 27) — so the rule is: enumerate them, and none reads
`stock_quantity` as a pool again.

The bug's signature is `available = MAX(stock_quantity) − pending`: the marketplace
already decremented its listing for the open order, so subtracting `pending` from it
counts the order twice. The pool must be `physical_stock` (→ ledger on_hand), with
`stock_quantity` used ONLY to display each marketplace's own listed number.

| # | Consumer | File | Reads pool as | Status |
|---|---|---|---|---|
| 1 | **Sync engine / write planner** | `lib/marketplace/stock-allocation.ts` (`computeAvailable`/`rawGroupAvailable`), driven by `stock-sync.ts` | `physicalStock ?? listedStock` | ✅ already correct — the authority |
| 2 | **Reconcile** (writes the pool) | `lib/marketplace/physical-stock.ts` | adopts `stock_quantity`→`physical_stock` (guarded) | writer, not reader; ledger replaces it |
| 3 | **Manual-stock reminder** | `lib/marketplace/manual-stock-pure.ts` | `computeAvailable(members)` | ✅ correct — delegates to the engine |
| 4 | **Display — Stocks page** | `lib/db/stock-groups.ts` (`poolOnHand`) | ~~`stock_quantity`~~ → `physical_stock` | ✅ FIXED (Aug 27) — now shows on-hand/reserved/available |
| 5 | **Display — Products page** | `lib/db/products.ts` (2 blocks) | ~~`stock_quantity`~~ → `physical_stock ?? …` | ✅ FIXED (Aug 27) |
| 6 | **Low-stock alerts** (Telegram) | `lib/db/alerts.ts` | ~~`stock_quantity`~~ → `physical_stock ?? …` | ✅ FIXED (Aug 27) — was firing false "running low" |
| 7 | **Browser extension** | `app/api/extension/product`, `…/stats` | raw `stock_quantity` (no pending subtraction) | ⚠️ not the double-count, but reads the LISTING, not the pool — switch to on_hand when the ledger lands |

**Ledger cutover checklist:** items 1 and 3 already funnel through `computeAvailable`,
so pointing that one function at ledger `on_hand` (the `onHand` param already exists on
`rawGroupAvailable`) converts them together. Items 4–6 each re-derive the pool inline
(the reason all three carried the same bug independently) — the durable fix is for them
to call a **single shared** `on_hand`/`available` accessor rather than re-implementing
it. Item 7 reads the listing directly and must be pointed at the same accessor. Until
then, `poolOnHand` (stock-groups.ts) is the shared display-side helper; the three
display consumers should converge on it.

## Day-1 shadow finding: a delivered order first-seen as terminal creates a phantom consume

Observed on the first real shadow pass:

```
ledger_shadow_row  pbblk  legacyPhysicalStock:0  legacyAvailable:0  ledgerOnHand:-1
```

PBBLK's only order (yandex 60675080064) was **DELIVERED on 2026-08-21** — shipped and
gone, which is why physical_stock is 0. Yet the ledger holds an open `consume -1`.

**Is this a "delivered reserves forever" bug? Not in the available sense.**
`available = max(0, on_hand) = max(0, -1) = 0`, so the ledger does NOT claim the unit
is sellable — it wouldn't oversell. Under Option A a completed sale's consume is
*meant* to be permanent (the unit physically left; crediting it back would falsely
restore on-hand), so the **absence of a "delivered closes the consume" transition is
correct by design**, and `orderLedgerStatus` mapping `delivered → live` correctly
*keeps* the consume for an order observed from placement. DELIVERED is (correctly)
NOT in `RESERVING_RAW_STATUSES` — the legacy pool reads `physical − pending`, and
physical already dropped, so counting it there would double-count.

**The real bug is at the BOUNDARY.** PBBLK was delivered six days before the ledger
first saw it. `diffLedger`'s rule is "live & not yet consumed → create a consume", so
a first-sighting of an already-delivered order **creates a consume NOW** — a *debit at
delivery*, which is exactly what Option A's *debit at placement* was designed to
avoid. For an order observed through its lifecycle this never happens (consume at
placement, kept through delivery). It happens only for orders first seen already
terminal — i.e. at shadow start, and **at seed time**.

**Why it would corrupt a seed.** The seed snapshots physical (or seller-confirmed
free-to-sell) on-hand, which *already excludes* every delivered unit. Any consume for
an order delivered BEFORE the seed therefore double-counts against that snapshot —
`on_hand` would start one unit low per pre-seed completed sale. This is the phantom
the finding warns about.

### Resolution — settle before the seed writer
1. **Only CREATE a consume for an order currently reserving (open).** `diffLedger`
   must split "keep an existing consume" (delivered → keep, don't credit) from
   "create a new consume" (only when the order is in a reserving raw status now). A
   first-sighting in a terminal state (delivered/cancelled/returned) creates nothing —
   its effect is already in physical / the seed baseline.
2. **Seed = snapshot; only open orders carry consumes across it.** The seed event sets
   `on_hand` to the confirmed value; the only consumes that may survive the seed are
   for orders still OPEN (reserving) at seed time. Pre-seed delivered/cancelled/
   returned orders contribute nothing beyond the baseline.
3. This is the concrete change the shadow's first pass forced: `orderLedgerStatus` /
   `diffLedger` need a "live-open vs live-closed" distinction, not a single `live`.

Until (1)–(2) are agreed and implemented, **do not build the seed writer** — seeding
onto the current create-on-first-sight rule bakes the phantom reservations in.
