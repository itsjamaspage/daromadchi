# Stock Ledger Wiring — Part 1 Spec

Last updated: 2026-08-27
Status: **awaiting review.** No code written. Part 1 begins only after sign-off.

Fixes the open audit finding: cancelling an order returns stock to 9, not 10.
Wires `lib/marketplace/stock-ledger.ts` — built, unit-tested and never imported —
so the group's on-hand becomes authoritative and a cancellation credits the pool
back.

---

## 0. Gates

Two hard gates. Neither is advisory.

### Gate A — the first deploy runs as a dry run, mandatory

The first time groups seed, **seeding runs with marketplace writes suppressed for
one full tick.** Every write that *would* have happened is recorded, and the diff
between the intended value and the current listing is reviewed by a human. Writes
are enabled only after that diff is reviewed and clean.

This touches live Uzum and Yandex listings. "The number should be identical" is
not sufficient — it must be verified against real seller data first. §9 specifies
the mechanism and the exact review query.

### Gate B — Part 1 and Part 2 are separate branches

Part 1 (this spec: correct pool, cancel returns 10) lands and is **verified in
production** — a real cancellation restoring to 10, plus a clean dry-run diff —
before Part 2 (wait-for-restock, propagate to the sibling, both-mode alerts)
begins. They are not merged together, and Part 2 does not start early.

---

## 0.1 What changed on `main` while this was being designed

Three things landed after the design conversation and before this spec was
written. They are recorded here because two of them contradict instructions
given for this spec, and one is a defect this work fixes.

**Migrations 087 and 088 are taken.** `087_orders_reserved_stock_snapshot.sql`
and `088_orders_restore_alert_sent_at.sql` shipped in #388. The kill-switch
migration in this spec is therefore **089**, not 087.

**A Part 2-shaped change has already merged.** #388 —
*"read-only 'restore your listing after cancel' alert (Parts 1 + 2)"* — shipped
the read-only half of Part 2 before Part 1 exists. Gate B still holds for
everything that remains, but it has already been crossed once. What is left of
Part 2 after #388 is listed in §12.

**The two descriptions of marketplace restock behaviour disagree.** The Part 2
brief states the cancelling marketplace restocks itself (*"the next sync sees its
listing go back up, Uzum 9→10"*). #388's own docblock states the opposite:

> When a read-only seller cancels an order, the marketplace does NOT put the unit
> back on the listing — it's physically on the shelf but unsellable.

#388 resolves this by observing rather than assuming: `pickVariant` emits ACTION
when the listing is still short and INFO when it recovered. **This spec does not
depend on either answer**, and that independence is the main argument for the
ledger — see §2. The disagreement should still be settled before Part 2's timing
rule is designed, because that rule *does* depend on it.

---

## 1. The bug

Reproduced against `computeAvailable` and `physicalStockFromRead`:

```
1. quiet                            physical=10  listed=10  pending=0  → available=10
2. after the marketplace decrement   physical= 9  listed= 9  pending=1  → available=8
3. after cancellation                physical= 9  listed= 8  pending=0  → available=9
   (if the pool had not moved:       physical=10  listed= 8  pending=0  → available=10)
```

Half the mechanism is already correct. When the marketplace reports the
cancellation, `lib/uzum/sync.ts` updates `marketplace_status`, `CANCELED` is not
in `RESERVING_RAW_STATUSES`, the order leaves `reservingOrderCondition()`, and
the reservation releases. That is not the problem.

The problem is the pool. `reconcilePhysicalStock`
(`lib/marketplace/physical-stock.ts`) adopts any listing read that differs from
our own most recent write:

```sql
UPDATE products p SET physical_stock = p.stock_quantity
 WHERE p.stock_quantity IS DISTINCT FROM (last 'sent' write for this product)
```

It cannot distinguish *"the marketplace took a unit for an order"* from *"the
seller restocked"*, so it adopts 9 as the real on-hand — and then step 2
subtracts the still-open order on top of it. That is the 8: one unit counted
twice. Cancelling releases the reservation but nothing credits the pool.

There are exactly two writers of `products.physical_stock` —
`reconcilePhysicalStock`, and the seller setting it by hand via
`/api/products/physical-stock`. Neither fires on a cancellation.

### 1.1 The same root cause makes #388's snapshot unreliable

`orders.reserved_stock_snapshot` (migration 087) captures
`products.physical_stock` the first time an order is seen reserving, and its
migration comment states the premise plainly:

> the marketplace decrements the listing, but physical_stock (the true pool) does
> not move — so this is the number the listing should be RESTORED to

**`physical_stock` does move**, by exactly the mechanism in §1, and the ordering
in `app/api/cron/sync/route.ts` makes it a race:

| line | step |
|---|---|
| 64–81 | stock refresh, then `reconcilePhysicalStock` — clobbers `physical_stock` to the decremented listing |
| 86 | `syncFromUzum` — captures `reserved_stock_snapshot` |
| 121 | `reconcilePhysicalStock` again, on a heavy tick |

If the order sync sees the order reserving before the next refresh+reconcile, the
snapshot is 10 and correct. If a stock refresh lands first, the snapshot is 9 and
the seller is told to restore their listing to the wrong number — or told it
"fixed itself" when it did not. Orders sync every 5 minutes and stock every 15,
so the common path is correct and the failure is silent.

**Part 1 fixes this at the root.** Once the pool stops absorbing the
marketplace's own decrement, the snapshot is correct by construction. No change
to #388 is required, and none is proposed here.

---

## 2. Why the ledger, and why it cannot be narrowed

The design question asked whether this could be scoped to just the cancellation
credit. It cannot, and the reason is worth stating because it is the whole
argument for the ledger.

Every listing-derived variant was traced and rejected:

| variant | why it fails |
|---|---|
| Credit the pool on cancel only | Fixes step 3 but leaves step 2 at 8. The double-count during the open order is what causes us to write a too-low number in the first place. |
| Reconstruct the pool as `listing + reserved-on-that-listing` | Correct only once the marketplace's decrement has been *observed*. Between the decrement and our next read the pool reads high — the oversell direction. |
| Gate adoption on "did the listing drop by exactly the newly-reserved amount" | A heuristic on two independently-moving numbers. Silently wrong whenever a real restock and an order land in the same window. |

All three share one flaw: they depend on observing the marketplace's own
decrement. `computeAvailable`'s ledger branch does not:

```ts
if (onHand != null) return Math.max(0, onHand)   // stock-allocation.ts:134
```

It never reads `physicalStock` or `listedStock`. Availability becomes a function
of events we ingest, not of a listing we poll. **That is the fix.** The `cancel`
credit is only correct if the `consume` debit is on the same ledger, so the two
rules ship together or not at all.

---

## 3. Activation — lazy auto-seed

A group joins the ledger on the **first sync after deploy that touches it**. One
group at a time; no big-bang migration, no seller action required.

### 3.1 The seed transaction

`seedGroup(userId, matchKey)` runs once per group, in **one transaction**:

| row | delta |
|---|---|
| `seed` | `+gross on-hand` — see §3.2, which is where the two sources differ |
| `consume` | `−qty`, one row per currently-open reserving order, carrying its `order_id_external` |

A group listing 9 with one open order of 1 seeds `+10, −1` → `on_hand = 9`.

Both rows are honest. The seed means *"the seller had 10 on the shelf"*; the
consume means *"one is committed"*. `on_hand = Σ delta` holds without any
zero-delta placeholder.

**This is what handles mid-flight orders.** Seeding at 9 and letting `diffLedger`
debit the open order afterwards gives 8 — losing one unit per open order at the
moment of the switch, permanently and silently. The consume rows must be written
by the seed itself, in the same transaction, or the switch is lossy.

### 3.2 Seed value — gross, not free-to-sell

The `seed` row is a **gross** on-hand: everything on the shelf, including units
already committed to open orders. The `consume` rows then net it down. Getting
this wrong in either direction loses or invents a unit per open order, so the two
sources are stated separately:

| source | gross seed | why |
|---|---|---|
| Seller baseline — `product_links.total_physical_stock` is set | **that number, used as-is** | It is already gross. `computeStockGroups` treats it as `leftover = total_physical_stock − sold_since_baseline`, i.e. a shelf count the sales are subtracted *from*. Adding open orders to it would double-count them. |
| No baseline | **current free-to-sell + units on open reserving orders** | The listing has already had the marketplace's own reservations removed, so the committed units must be added back to recover the shelf count. |

"Current free-to-sell" means `MAX` across FBS members, matching
`computeStockGroups`. Prefer the baseline when both are available: it is a number
the seller confirmed, and the listing may already have drifted.

Rationale for auto-seeding rather than requiring confirmation: a listing that has
already drifted gets frozen as truth, but **that same listing is already the pool
today**. Auto-seeding is no worse than the status quo at the moment of the switch
and strictly better afterwards, and it needs nothing from the seller.

### 3.3 Idempotency

The existing unique index carries this:

```sql
stock_ledger_user_key_reason_order_unique (user_id, match_key, reason, order_id_external)
```

`seed` rows carry `order_id_external = NULL`, and Postgres treats NULLs as
distinct — so the index does **not** prevent a second seed. Seeding must
therefore check for an existing `seed` row for `(user_id, match_key)` inside the
transaction and no-op if present. Order-driven rows are protected by the index as
designed.

`note` records the derivation of every seed (which source, which listings, which
open orders) so a wrong seed can be explained after the fact.

---

## 4. Same-tick ordering

On the tick where a cancellation is ingested, two things can move at once: the
`cancel` credit fires, and the marketplace's listing may go back up on its own.
If drift is evaluated first, the +1 is adopted as a `manual` credit **and** the
cancel credits again → 11.

The order within a tick is fixed, and tested:

```
1. ingest orders            (marketplace_status updates)
2. diffLedger               (append consume / cancel / return)
3. only then evaluate drift (append manual)
```

Step 3 must never run before step 2 in any code path. This is the one ordering
constraint in the design and the test in §10 exists specifically for it.

---

## 5. Restock adoption — increases only

Once a group is on the ledger, listings no longer feed the pool. A seller who
restocks directly on Uzum would otherwise become invisible, and today that
restock propagates to Yandex.

**Rule.** A listing read *higher* than the ledger expects, unexplained by our own
write or by a cancellation, becomes a `manual` credit for the difference — so
restocking on a marketplace still propagates to its sibling, exactly as it does
now. A read *lower* than expected is **logged and never applied.**

Asymmetric on purpose. An unexplained drop is what an un-ingested order looks
like; believing it would raise the sibling into an oversell. This is the same
undersell-not-oversell bias the ledger already chose, and the same bias
`physicalStockFromRead` was reaching for.

---

## 6. Prerequisite — unify the grouping key

`stock-sync.ts:42` defines its own local `normalizeKey`. The body is
byte-identical to the exported one at `stock-groups.ts:91`, but **stock-sync does
not resolve the merge chain** (`product_group_merges`), and `stock-groups.ts`
does.

So a group the seller merged in the UI is one `match_key` for display and two for
the sync. `stock_ledger` is keyed on `match_key`. A credit would land on a key
the sync never looks up, and the unit would not come back.

One exported, merge-resolving key function, used by both. This lands inside
Part 1, before the ledger reads anything, and carries its own test.

---

## 7. Exclusions, and the legacy path

`onHand` returns `null` — legacy path, byte-for-byte unchanged — when the group:

- has no `seed` row yet;
- contains any FBO/FBY member;
- belongs to a user with the kill-switch set (§8).

**Why FBO is excluded.** `stock-sync.ts` has zero fulfilment awareness: it MAXes
every group as one shared pool, including FBO groups whose marketplace warehouses
hold genuinely independent inventory. That is a pre-existing bug and this spec
does not fix it — but `stock_ledger` calls itself the *FBS shared pool*, and
seeding FBO groups onto it would formalise the wrong assumption in a new place.
`computeStockGroups` already buckets members by `fulfillment_type`; the same test
gates seeding.

Read-only shops never reach the writer at all — the `stock-sync` cron selects
`api_mode = 'stock_sync'` only — so the read-only guarantee is untouched and
`test:guard` stays green. This is asserted, not assumed (§10).

---

## 8. Kill switch

A global `STOCK_SYNC_KILL_SWITCH` env var already exists
(`stock-writer.ts:98`) and disables **all** writes instantly. It stays as is.

Migration **089** adds a per-user column so one seller can be parked without a
deploy and without stopping everyone else. When set, that user's groups return
`onHand = null` and fall back to the legacy path — they are not merely frozen,
they behave exactly as they do today.

---

## 9. Gate A — the mandatory first-deploy dry run

### 9.1 Mechanism

No new logging is needed. `stock_write_log` already carries a `dry_run` column
and `stock-writer.ts` already honours it.

The first tick after deploy runs with seeding **enabled** and marketplace writes
**suppressed**: every intended write is recorded as a `stock_write_log` row with
`dry_run = true`, carrying the target quantity. Nothing reaches Uzum or Yandex.

### 9.2 The review

The diff is a query over that table, comparing the intended quantity against the
listing at the time:

```sql
SELECT w.product_id, p.sku, p.stock_quantity AS current_listing,
       w.quantity AS would_write,
       w.quantity - p.stock_quantity AS delta
  FROM stock_write_log w
  JOIN products p ON p.id = w.product_id
 WHERE w.dry_run = true
   AND w.created_at >= :deploy_at
 ORDER BY abs(w.quantity - p.stock_quantity) DESC;
```

**Clean means:** every row's `delta` is either 0, or explained by an open order
or a known drift, with the explanation written down. A row nobody can explain is
a blocker, not a curiosity.

### 9.3 Enabling writes

Writes are enabled only after a human has reviewed that output and recorded the
verdict. Until then the suppression stays on. There is no time-based or automatic
promotion.

---

## 10. Tests

The behavioural requirement, first:

1. **Cancel returns stock to 10, not 9.** The end-to-end case from §1, driven
   through the real ledger path.

Then the ones that protect the mechanism:

2. **Seeding with an open order yields free-to-sell, not free-to-sell − qty.**
   The mid-flight case: a group listing 9 with one open order seeds to
   `on_hand = 9`, and cancelling that order credits to 10.
3. **Re-running the seed is a no-op.** Guards the NULL-distinct gap in §3.3.
4. **A cancellation and a marketplace self-restock in the same tick credit
   once, not twice.** The §4 ordering constraint. This is the test most likely
   to catch a future refactor that reorders the tick.
5. **An FBO group never seeds** and keeps the legacy result exactly.
6. **A merged group resolves to one key** across sync and display (§6).
7. **An unexplained listing increase becomes a `manual` credit; an unexplained
   decrease does not** (§5).
8. **An un-seeded group's `available` is byte-identical to today's**, asserted
   against the current implementation rather than a restated expectation.
9. **`test:guard` stays green** and no read-only shop reaches the writer.

Every guardrail is verified adversarially — by reintroducing the behaviour it
bans and confirming it fails with a useful message — as with the money and
week-maths guards.

---

## 11. Files

**New**

- `lib/marketplace/stock-ledger-db.ts` — the only DB-touching ledger module:
  read events for a group, seed a group, apply `diffLedger` output, append
  `manual` drift events. Kept separate from the pure `stock-ledger.ts` so the
  pure logic stays unit-testable with no database.
- its test file, plus an integration test for the seed transaction.
- `migrations/migrations/089_users_ledger_kill_switch.sql`.

**Changed**

- `lib/marketplace/stock-sync.ts` — pass `onHand` into `planStockWrites`
  (currently called without it at `:443` and `:676`); use the shared key.
- `lib/db/stock-groups.ts` — export the merge-resolving key function.
- `lib/marketplace/physical-stock.ts` — skip products in ledger-active groups.
- `lib/db/schema.ts` — the kill-switch column.

**Untouched, deliberately**

- `lib/marketplace/stock-ledger.ts` — pure and already correct. Wiring it must
  not require editing it; if it does, the wiring is wrong.
- `lib/marketplace/stock-writer.ts`, `lib/marketplace/order-cancel.ts`,
  `lib/marketplace-readonly-guard.ts` — no marketplace write behaviour changes
  in Part 1.
- `lib/marketplace/cancel-restore-*.ts` (#388) — Part 1 makes its snapshot
  correct without touching it (§1.1).

---

## 12. The Part 1 / Part 2 boundary

Part 1 is done when, in production:

- a real cancellation restores the group to 10, observed end to end; and
- the Gate A dry-run diff has been reviewed and recorded clean; and
- writes have been enabled and one subsequent tick is clean.

Only then does Part 2 start, on its own branch.

**What remains for Part 2 after #388:** the read-only alert already shipped. Left
to build are edit-mode propagation to the sibling listing, the edit-mode
confirmation alert (*"we fixed it for you — Yandex is back to 10"*), and the
wait-for-restock timing rule.

That timing rule needs a signal this spec does not provide: something that
distinguishes *"the cancelling marketplace has restocked"* from *"we have not
looked yet"*. `shops.stock_synced_at` and `products.stock_changed_at`
(migration 082) are the candidates. It also needs §0.1's disagreement settled —
if the marketplace does not restock itself, "wait until it does" never fires.
Both are Part 2's design, not this one's.

---

## 13. Risks

**Live listings move.** The first seeded tick changes what edit-mode shops write.
Gate A exists for exactly this and is the reason it is mandatory rather than
recommended.

**A wrong seed is durable.** `on_hand` is authoritative; a bad seed is wrong until
someone corrects it. Mitigated by the `note` audit trail, the per-user kill
switch, and the dry-run review — not eliminated.

**The ledger stops hearing the marketplace.** §5's increases-only adoption is the
only path back in. If it is too conservative, a seller's restock could take a
tick longer to propagate than today. That is the safe direction, and it is a
deliberate trade.

**`match_key` is now load-bearing.** After §6 it decides where credits land. A
future change to key normalisation silently redirects them. The test in §10.6
pins the two call sites together; it does not pin the key format itself.

---

## 14. What this spec deliberately does not do

- **It does not fix the FBO MAX-as-one-pool bug.** Named in §7, excluded from the
  ledger, left for its own change.
- **It does not backfill history.** No attempt to reconstruct past movements;
  the ledger starts at the seed.
- **It does not change any marketplace write behaviour.** The values written may
  change because `available` is now correct; the write path, its guard, and its
  audit trail do not.
- **It does not touch #388.** The cancel-restore alert keeps working and gets
  more accurate for free.
