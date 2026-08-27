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
