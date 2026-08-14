# Payouts settlement-accuracy — implementation plan

Branch: `fix/payouts-settlement-accuracy` (off clean `main`). Separate from
`fix/fbs-stock-sync-ledger` and unrelated to ATMOS — neither is touched.

**Status: PLAN ONLY. No code in this commit.**

Two confirmed payout-accuracy bugs, both making earnings look further along than the
marketplace reports:

- **BUG 1** — Uzum orders labeled "Выплачено/paid" from the calendar, when the money is
  only "Доступно к выводу" (available, unwithdrawn). Root cause `lib/db/payouts.ts:372`
  (`status: isPast ? 'paid' : 'pending'`, `isPast = monthKey < currentMonth` at `:345`).
- **BUG 2** — Yandex in-process orders enter the "settled" monthly bucket the moment a
  credit posts, so `netPayout = settled.credit − settled.debit` with `debit=0` counts
  full gross (0 fees) into the pending KPI. Root cause `lib/db/payouts.ts:280` +
  `components/dashboard/PayoutsView.tsx:349`.

A discovery from the screenshots that shapes BUG 1: the Uzum "История выплат" batch that
covers order 117751391 (№5000360785, 55 550) shows a **✗ (failed)** icon, while a later
batch (№5000390691, 50 300) shows a **⏳ (pending)** icon. So "paid" is not merely
"a batch exists" — it must be "the order is in a **successfully completed** payout batch."
This is exactly why Uzum still shows the order as available-to-withdraw.

---

## 0. Guiding principles

1. **Status is driven by events, never the calendar.** Delete every `isPast ? … : …`
   status derivation. A period being "in the past" says nothing about whether money moved.
2. **Under-claim, never over-claim.** When a signal is missing/ambiguous, fall to the
   *less* advanced state (available < paid; pending-with-fees-flag < settled). The whole
   bug class is over-optimistic labeling; the fix must bias the other way.
3. **Additive, nullable, reversible schema.** New columns default-null; new table is
   independent. A missing payout-history feed degrades to "available_to_withdraw", not a
   crash and not a false "paid".
4. **Don't paint the monthly-bucket corner smaller.** The real grain is per-order
   settlement state rolled *up* to month for display. This fix computes state per order
   and aggregates for the KPI, so a later per-order migration is easier, not harder.

---

## 1. Status model

### 1.1 New `PayoutStatus` (replaces the string union at `lib/types.ts:260`)

Current: `'paid' | 'pending' | 'processing' | 'estimated_paid' | 'estimated_pending'`.

Proposed canonical set (order = settlement progress):

| Status | Meaning | Driving signal |
|---|---|---|
| `estimated_pending` | current month, no real data | no settlement rows, month ≥ current |
| `estimated_paid` | past month, only UE-percentage estimate | no settlement rows, month < current (estimate branch only) |
| `pending` | real settlement in progress, fees final | settled + fees present + not in a completed payout |
| `fees_pending` *(new)* | settled credit posted, **debits not yet posted** | Yandex: `credit>0 && debit==0` (or partial) — **BUG 2 flag** |
| `available_to_withdraw` *(new)* | earned, withdrawable, **not withdrawn** | Uzum order `status = TO_WITHDRAW` and not in a completed payout batch |
| `paid` | money actually left the marketplace to the seller | order is in an **ingested, COMPLETED** payout-history batch |

Notes:
- `fees_pending` is a **sub-state of pending** for totaling (it stays inside the pending
  bucket) but renders a distinct "≈ fees pending" badge. It is NOT a new KPI column.
- `processing` (already in the union, currently unused by the settled branches) is folded
  into `pending`/`estimated_pending`; keep the enum value for back-compat but stop emitting
  it, or drop it in the type change (see Blast radius §6 for the one render site).

### 1.2 Signal → status mapping

**Uzum** (per `uzumSettlementOrders.status`, ingested at `lib/uzum/settlements-sync.ts:132`;
enum from `lib/uzum/client.ts:251` = `TO_WITHDRAW | PROCESSING | CANCELED | PARTIALLY_CANCELLED`):

```
PROCESSING           → pending
TO_WITHDRAW          → available_to_withdraw    (unless covered by a COMPLETED payout batch → paid)
CANCELED / PARTIALLY_CANCELLED → excluded (already handled at payouts.ts:236, shown in returns)
covered by completed payout batch (new feed) → paid
```

**Yandex** (per `yandexSettlementTransactions`, aggregated `payouts.ts:183–202`):

```
no settlement txns for the period         → estimated_pending (current) / awaiting (past)  [unchanged, filtered out]
credits AND debits present (fees final)   → pending (current month) / paid (…but see §4: paid needs a payout signal, not isPast)
credits present, debits absent/partial    → fees_pending    (BUG 2 flag; stays in pending bucket)
```

Yandex has **no order-level withdrawal feed** in scope. So Yandex `paid` cannot be proven
today either. Interim: Yandex settled+fees-final past-month rows keep showing as `pending`
(honest "settled, payout not confirmed") rather than a calendar-based `paid`. A future
Yandex payout/netting-payment ingestion can add real `paid` — parked, not built now.
(This is a deliberate scope line: BUG 1's "build a real paid" is Uzum-only; Yandex `paid`
is a follow-up. Flag for owner sign-off.)

---

## 2. Schema / migrations (additive, nullable, low-risk)

### 2.1 New table: `uzum_payout_batches` (the "История выплат" batches)

```
uzum_payout_batches
  id                uuid pk
  shop_id           uuid → shops.id (cascade)
  batch_ext_id      text        -- Uzum's №5000390691
  amount            numeric(14,2)
  status            text        -- normalized: completed | pending | failed  (from the ⏳/✗/✓ icons)
  paid_at           timestamptz -- batch date (14.08.2026)
  period_from       timestamptz null  -- if the feed exposes the covered window
  period_to         timestamptz null
  covered_order_ids jsonb null   -- if the feed lists orders; else null → reconcile (§3.3)
  raw               jsonb        -- full payload for forensic/debug
  synced_at         timestamptz default now()
  UNIQUE (shop_id, batch_ext_id)   -- idempotent dedupe by batch id
  index (shop_id, paid_at)
```

### 2.2 New column on `uzum_settlement_orders` (link an order to its completed batch)

```
payout_batch_id   uuid null → uzum_payout_batches.id   -- set by reconciliation (§3.3); null = not yet paid
payout_confirmed  boolean not null default false        -- true ONLY when in a COMPLETED batch
```

`payout_confirmed=false` is the safe default → order stays `available_to_withdraw`, never
false-`paid`. Both columns nullable/defaulted → additive, no backfill required to deploy.

### 2.3 New column for BUG 2 (surface, not compute-from-scratch each time)

Option A (preferred, cheap): compute `fees_pending` on the fly in `payouts.ts` from the
credit/debit split already aggregated there — **no schema needed**. Only add a column if we
later want per-order Yandex state. Recommendation: **no new Yandex column now**; derive the
flag in computation (§4.2). Keeps the migration to exactly one new table + two Uzum columns.

### 2.4 Migration mechanics

- Drizzle: add table + columns to `lib/db/schema.ts`, generate SQL with the repo's existing
  migration workflow (drizzle-kit), commit the generated SQL. All statements are
  `CREATE TABLE` / `ADD COLUMN … NULL/DEFAULT` — **no locks of consequence, no data rewrite**.
- Deploy order: migration runs before the new sync/compute code reads the columns; because
  everything is nullable-with-safe-default, old code tolerates the new columns and new code
  tolerates empty batch data. No coordinated cutover.

---

## 3. Ingestion — Uzum payout-history sync

### 3.1 Endpoint research (leverage existing discovery, don't guess)

The repo already has `discoverUzumFinancePaths()` (`lib/uzum/client.ts:457`) which reads
Uzum's `/swagger/api-docs` and returns every finance-ish path (keyword regex already
includes `payout|withdraw|settlement|transaction|operation`). Plan:

1. **Live discovery step (VPS, read-only):** run `discoverUzumFinancePaths(token)` against
   the seller token and record the actual payout/withdrawal paths Uzum exposes. Candidates
   from the existing fallback list (`client.ts:585–597`) and Uzum seller-API shape:
   `/v1/finance/operations`, `/v1/finance/transactions`, `/v1/finance/payments`,
   `/v1/finance/withdrawals`, `/v1/seller/balance`. The "История выплат" list is the target.
2. **Confirm the response shape** with a throwaway read-only probe (same pattern as the
   `scripts/atmos-*`/colour probes — VPS-run, dumps JSON, no writes): batch id, amount,
   date, status icon → normalized status, and crucially **whether the payload lists the
   orders each batch covers**. This determines §3.3.
3. Only after the shape is confirmed do we finalize the parser. The plan does not hardcode a
   guessed endpoint — discovery + probe first.

**Flag:** the exact endpoint and whether it returns covered-order ids is **unconfirmed until
the live probe**. The reconciliation design (§3.3) is built to work either way.

### 3.2 The sync function

`lib/uzum/payout-history-sync.ts` (new), mirroring `settlements-sync.ts`:
- Auth: same `request()` helper (`Authorization: <token>`, no Bearer) via the read-only
  marketplace guard — a **GET read**, so no guard allowlist change needed (only POST/PUT/…
  writes are gated).
- Resolve numeric Uzum `shopIds` the same way `settlements-sync.ts` does.
- Page the payout-history endpoint; upsert each batch into `uzum_payout_batches`
  **keyed on `batch_ext_id`** (idempotent; re-running never duplicates). Update `status` on
  conflict (a ⏳ pending batch can flip to ✓ completed or ✗ failed on a later run — same
  "state flips for weeks" reality noted in `settlements-sync.ts:15`).
- Cadence: piggyback the existing settlement trigger. `syncUzumSettlements` is invoked from
  `app/api/uzum/refresh-settlements/route.ts:42`; add the payout-history sync to the same
  route (and whatever cron/refresh drives it) so batches refresh on the same schedule as
  `/finance/orders`. No new cron entry required.

### 3.3 Order ↔ batch reconciliation

Two cases, decided by the §3.1 probe:

**Case A — feed lists covered order ids** (best): write them to
`uzum_payout_batches.covered_order_ids`; the reconciler sets
`uzum_settlement_orders.payout_batch_id` + `payout_confirmed = (batch.status='completed')`
by direct join. Deterministic.

**Case B — feed is batch-level only (id/date/amount/status), no order list** (likely, per the
screenshots which show only №/date/amount): reconcile heuristically, **conservatively**:
- Candidate orders = `TO_WITHDRAW` items in the batch's covered window (or, absent a window,
  items with `date_issued_at ≤ batch.paid_at` not already linked).
- Match when a subset's `withdrawn_profit`/net **sums to the batch `amount`** (exact-first;
  the 55 550 batch equals the single order's 55 550 net, so singletons resolve cleanly).
- Only a **completed** batch sets `payout_confirmed = true`. A **failed** batch (✗, like
  №5000360785) sets nothing → the order correctly stays `available_to_withdraw` (this is the
  precise bug in the ticket). A **pending** batch (⏳) also sets nothing until it completes.
- If the amount can't be reconciled unambiguously → **leave unlinked** (stays available). We
  never guess an order into `paid`.

**Flag for owner:** Case B is heuristic. It is safe (under-claims), but a batch covering many
same-priced orders could be ambiguous. If the probe shows Case A, we skip all of this.

---

## 4. Computation changes (`lib/db/payouts.ts`)

### 4.1 BUG 1 — Uzum status off events (delete the calendar)

In the Uzum settled branch (`:342–381`):
- Remove `const isPast = monthKey < currentMonth` (`:345`) and the `isPast ? 'paid':'pending'`
  (`:372`).
- Because the current entry is a **monthly bucket**, derive its status by **rolling up the
  per-order statuses** in that bucket (see §5): the aggregation must carry, per (shop×month),
  counts of orders by derived state. Roll-up rule (conservative):
  - all covered by completed payout batch → `paid`
  - else any `TO_WITHDRAW` (available) present → `available_to_withdraw`
  - else → `pending` (PROCESSING)
- This means the Uzum aggregation at `:217–255` must additionally select each order's
  `status`, `payout_confirmed`, and `payout_batch_id`, and split the bucket's net into
  paid / available / pending sub-totals (needed for §4.3 KPIs).

### 4.2 BUG 2 — Yandex partial-netting detection

In the Yandex settled branch (`:274–336`):
- Keep `netPayout = settled.credit − settled.debit` (`:280`) — the row stays **visible at its
  gross-ish net** so the total doesn't mysteriously drop (owner's Option B).
- Add detection: `feesPending = settled.credit > 0 && settled.debit === 0` (extend to
  "debits look partial" if the probe shows partial postings — e.g. delivery present but
  commission absent). When `feesPending`, set `status = 'fees_pending'` and a boolean
  `feesFinal = false` on the entry.
- Do **not** flip such a row to `paid` by calendar. Past-month, fees-final Yandex rows stay
  `pending` (no proven payout) until a Yandex payout feed exists (§1.2 scope note).

### 4.3 `PayoutsView` totals (`components/dashboard/PayoutsView.tsx:341–350`)

Today: `totalPaid` (paid+estimated_paid) and `pending` (everything else), both summing
`netPayout` over `withKnownNet`. Change to **three buckets**:
- **Всего выплачено / paid** = sum `netPayout` where `status ∈ {paid, estimated_paid}`.
  With BUG 1 fixed, Uzum `available_to_withdraw` **leaves** this bucket (the 55 550 J16 order
  moves out of "paid").
- **Доступно к выводу / available_to_withdraw** *(new KPI tile)* = sum where
  `status = available_to_withdraw`.
- **Ожидает / pending** = sum where `status ∈ {pending, fees_pending, estimated_pending}`.
  Inside this, `fees_pending` rows render an "≈ fees pending / fees not final" badge
  (`StatusBadge`, `PayoutsView.tsx:66–100`) and, in the row's net cell, a marker that the net
  excludes not-yet-posted fees. The pending **total still includes** them at gross (owner's
  Option B — visible, flagged, not silently dropped).

Net effect on the ticket's numbers: the July Uzum J16 (55 550) moves paid → available; the
August Yandex M9 (100 000) stays in pending but flagged `fees_pending`; the pending KPI is no
longer silently overstated-as-final — it's overstated-but-labeled, which is the agreed
behavior.

---

## 5. The deeper structural issue (monthly bucket grain)

The tables are already **per-order** (`uzum_settlement_orders`, one row per order-item;
`yandex_settlement_transactions`, per txn). Only `payouts.ts` collapses them to
`"YYYY-MM|marketplace"` buckets *before* deriving state — so **month state is pushed down
onto orders**, which is backwards and is the mechanism behind both bugs (one late credit
flips a whole month to "settled"; one past month flips every order to "paid").

This plan **computes state per order and rolls up for display**:
- BUG 1's roll-up (§4.1) derives the bucket status from its members' states, not the month.
- BUG 2's flag (§4.2) is a period-level signal now, but the new `payout_confirmed` /
  per-order Uzum fields mean the data is already per-order; a later change can emit per-order
  `PayoutEntry`s without touching ingestion or schema again.

**Decision:** do **not** rebuild the bucketing now (out of scope, higher risk). But this fix
**must not deepen the month-grain assumption** — specifically, no new logic may key
`paid`/`available` off `monthKey` comparisons. All new state derivation reads order rows.
That keeps the door open to a per-order `PayoutEntry` refactor later.

---

## 6. Blast radius

**Consumers of `getPayoutEntries` / `PayoutEntry`:**
- `app/dashboard/payouts/page.tsx:7` → `PayoutsView` — the only reader. Status/KPI changes
  are contained to this page. ✅
- No other import of `getPayoutEntries` anywhere (grep-confirmed).

**`PayoutEntry.status` render sites:** `PayoutsView.tsx` `StatusBadge` (`:66–100`) and the
export mapping (`:366`). Adding `available_to_withdraw` + `fees_pending` requires:
- new badges in `StatusBadge`,
- new KPI tile + revised `totalPaid`/`pending`/new `available` sums (`:341–350, 477–483`),
- export column mapping (`:356–366`) — CSV/XLSX "Статус" text for the two new states.

**i18n:** add labels in `lib/dashT.ts` payouts block (uz/ru/en) — `statusAvailable`
("Доступно к выводу"/"Chiqarishga tayyor"/"Available to withdraw"), `statusFeesPending`
("≈ Комиссия ожидается"/…/"≈ fees pending"), and a new KPI label `kpiAvailable`. Existing keys
at `dashT.ts:314, 715, 1117, 1187`.

**P&L / `real-financials.ts`** reads `uzum_settlement_orders` **and its `status`** directly
(`:108–134`) — a **separate consumer** of the same tables, independent of `payouts.ts`. The
schema additions are nullable → P&L is unaffected unless we choose to also use
`payout_confirmed` there (out of scope; note it as a future consistency follow-up).

**Telegram digest / alerts:** grep-confirmed they do **not** consume payout status or
`netPayout` (`lib/telegram-digest.ts` has no settlement/net references). ✅ No alert changes.

**Exports:** the "Скачать" export in `PayoutsView` (`:356–366`) is the only export; update its
status text + add columns for the new states. No other export path.

**Migration + backfill:**
- Migration is additive (§2.4) — safe to deploy ahead of code.
- **Backfill = recompute, not rewrite.** Historical Uzum statuses are *derived* at read time
  from `uzum_settlement_orders.status` + batches, so once the payout-history sync has run and
  reconciled, past periods automatically re-derive correctly on the next page load — no data
  migration of historical `PayoutEntry`s (they aren't stored; they're computed). The only
  backfill action is a **one-time full payout-history sync** (all batches in the 12-month
  window `payouts.ts:19–20`) so old TO_WITHDRAW orders that were truly paid get linked.
- Until that first payout-history sync runs, every Uzum order shows at most
  `available_to_withdraw` (never false-paid) — a safe, honest interim.

---

## 7. Tests

Unit tests (pure functions, no network) mirroring the existing
`lib/marketplace-readonly-guard.test.ts` style, plus a computation harness for `payouts.ts`.

**BUG 1 — available vs paid:**
1. Uzum order `status=TO_WITHDRAW`, **no** payout batch → entry status
   `available_to_withdraw`, and its net is in the *available* KPI, **not** paid. (The 55 550
   J16 case.)
2. Uzum order `TO_WITHDRAW` covered by a **completed** batch → `paid`.
3. Uzum order `TO_WITHDRAW` covered by a **failed** batch (✗) → stays
   `available_to_withdraw`, `payout_confirmed=false` (the exact №5000360785 scenario).
4. Uzum order `TO_WITHDRAW` covered by a **pending** batch (⏳) → stays available until it
   completes.
5. Uzum order `status=PROCESSING` → `pending` (never available/paid).
6. **Calendar-removal regression:** a past-month Uzum order with no completed batch must
   **not** be `paid` (asserts `isPast` derivation is gone).

**BUG 2 — Yandex partial netting:**
7. Period with credit>0, debit=0 → status `fees_pending`, `feesFinal=false`, row visible at
   gross net, counted in pending total. (The 100 000 M9 case.)
8. Period with credit>0 and debits present → `pending` (or paid only via a real payout
   signal, not calendar), `feesFinal=true`, fees applied.
9. Uzum control: order `PROCESSING` with commission+delivery present → fees applied
   pre-settlement (the 121172241 contrast — proves the Yandex flag is marketplace-data-driven,
   not a blanket rule).

**Reconciliation (§3.3):**
10. Case B: batch amount == single order net → linked + `payout_confirmed` when completed.
11. Case B: ambiguous amount (two same-priced candidates, batch = one) → **unlinked**, stays
    available (asserts we under-claim).

**KPI totals (`PayoutsView`):**
12. Given a mix, assert the three sums (paid / available / pending incl. fees_pending) and
    that fees_pending rows carry the badge flag.

---

## Open questions for owner sign-off

1. **Yandex `paid`** is deferred (no order-level withdrawal feed in scope). OK to keep Yandex
   settled rows as `pending` (never calendar-`paid`) until a Yandex payout feed is added?
2. **Reconciliation Case B** (heuristic amount/date match) — acceptable as the interim if the
   live probe shows Uzum's payout-history feed doesn't list covered orders? (Safe: under-claims.)
3. Drop the unused `processing` status value from the union, or keep for back-compat?

---

## Rollout order (once approved)

1. Live read-only probe on VPS: `discoverUzumFinancePaths` + payout-history shape dump
   (confirms endpoint + Case A/B). *(Throwaway, uncommitted — same flow as prior probes.)*
2. Schema migration (table + 2 Uzum columns) — deploy first, safe/additive.
3. Payout-history sync + reconciler; wire into `refresh-settlements` route.
4. `payouts.ts` status/computation rewrite (events, not calendar) + BUG 2 flag.
5. `PayoutsView` three-bucket KPIs + badges + export + i18n.
6. Tests (§7); one-time historical payout-history backfill sync.
