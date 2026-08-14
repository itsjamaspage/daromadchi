# Payouts settlement-accuracy — implementation plan

Branch: `fix/payouts-settlement-accuracy` (off clean `main`). Separate from
`fix/fbs-stock-sync-ledger` and unrelated to ATMOS — neither is touched.

**Status: PLAN ONLY. No code changes yet.**

Two confirmed payout-accuracy bugs, both making earnings look further along than the
marketplace reports:

- **BUG 1** — Uzum orders labeled "Выплачено/paid" from the calendar, when the money is
  only "Доступно к выводу" (available, unwithdrawn). Root cause `lib/db/payouts.ts:372`
  (`status: isPast ? 'paid' : 'pending'`, `isPast = monthKey < currentMonth` at `:345`).
- **BUG 2** — Yandex in-process orders enter the "settled" monthly bucket the moment a
  credit posts, so `netPayout = settled.credit − settled.debit` with `debit=0` counts
  full gross (0 fees) into the pending KPI. Root cause `lib/db/payouts.ts:280` +
  `components/dashboard/PayoutsView.tsx:349`.

---

## 0. GO/NO-GO PROBE RESULT — Bug 1 "paid" is NOT buildable now (verdict: RED)

The full Option-B plan (event-driven "paid" from ingested Uzum payout batches) hinged on a
reachable payout-history endpoint. A read-only live probe on the VPS
(`discoverUzumFinancePaths` + direct GETs against real Uzum finance auth) settled it:

- **Uzum's swagger exposes only two finance paths for this account:**
  `GET /v1/finance/orders` and `GET /v1/finance/expenses`. **No payout/withdrawal-batch
  endpoint exists in the API surface.**
- **Every payout/withdrawal candidate returned `403 RBAC: access denied`** (not 404, not a
  param error) — `/v1/finance/payments`, `/payouts`, `/withdrawals`, `/operations`,
  `/transactions`, `/balance`, `/seller/payouts`, etc. The endpoints may exist server-side
  but this token's role is not permitted to call them.

**Consequence:** the "История выплат" batch data — including the ✗-failed №5000360785 signal
that keeps order 117751391 "available" — is **unreachable from current API access**. A true,
event-proven **`paid`** state for Uzum cannot be built today.

**This is "deferred pending API access", NOT "impossible forever."** Because the denials are
`403 RBAC` (permissions) rather than `404`, Uzum may be able to grant finance-payout API
access to the token's role. Action item (owner): open a support ticket with Uzum requesting
finance/payout-history API scope. If granted, the deferred Option-B design in the Appendix
becomes buildable.

### What we build instead (fallback — still fixes the reported bug)

Bug 1 becomes a **two-state relabel** driven by the one real signal we *can* read,
`uzumSettlementOrders.status` (already ingested at `lib/uzum/settlements-sync.ts:132`):

```
PROCESSING            → pending
TO_WITHDRAW           → available_to_withdraw     (the 55 550 J16 sits here — no longer "paid")
CANCELED / PARTIALLY_CANCELLED → excluded (already handled at payouts.ts:236; shown in returns)
```

**No Uzum `paid` state** is emitted — nothing in the accessible data proves money left the
balance. This kills the actual lie ("available shown as paid") completely and honestly.
Bug 2 (Yandex) is untouched by the RED verdict and proceeds as planned.

---

## 1. Guiding principles

1. **Status is driven by events, never the calendar.** Delete every `isPast ? … : …`
   status derivation. A period being "in the past" says nothing about whether money moved.
2. **Under-claim, never over-claim.** When a signal is missing/ambiguous, fall to the
   *less* advanced state (available < paid; pending-with-fees-flag < settled). The whole bug
   class is over-optimistic labeling; the fix biases the other way — hence: no Uzum `paid`
   without a payout feed.
3. **Additive, reversible.** The fallback needs **zero schema change** — status is derived at
   read time from columns already ingested. Nothing to migrate, nothing to back out.
4. **Don't paint the monthly-bucket corner smaller.** Compute state per order, roll up to the
   month for display, so a future per-order refactor (and the deferred Option-B) stays easy.

---

## 2. Status model

### 2.1 `PayoutStatus` (the union at `lib/types.ts:260`)

Current: `'paid' | 'pending' | 'processing' | 'estimated_paid' | 'estimated_pending'`.

Proposed set:

| Status | Meaning | Driving signal | In this phase? |
|---|---|---|---|
| `estimated_pending` | current month, no real data | no settlement rows, month ≥ current | unchanged (filtered from page) |
| `estimated_paid` | past month, UE-% estimate only | no settlement rows, month < current | unchanged (filtered from page) |
| `pending` | real settlement in progress, fees final | Uzum `PROCESSING`; Yandex credits+debits present | **yes** |
| `available_to_withdraw` *(new)* | earned, withdrawable, **not withdrawn** | Uzum `TO_WITHDRAW` | **yes** |
| `fees_pending` *(new)* | settled credit posted, **debits not yet posted** | Yandex `credit>0 && debit==0` — BUG 2 flag | **yes** |
| `paid` | money actually left the marketplace to the seller | — | **NO — deferred** (no accessible feed for Uzum; no order-level feed for Yandex) |
| `processing` | (legacy, unused) | — | **kept, deprecated** (see §6; no removal, no migration) |

Notes:
- `fees_pending` is a **sub-state of pending** for totaling (stays in the pending bucket) but
  renders a distinct "≈ fees pending" badge.
- `paid` / `estimated_paid` remain valid enum members (back-compat + future feeds) but **no
  settled-branch entry emits `paid`** in this phase. `estimated_paid` is still produced by the
  UE-estimate branch, which the page filters out (`payouts.ts:435`), so **no row renders as
  "paid" on the Payouts page after this fix**. See §4.3 for the KPI consequence.

### 2.2 Signal → status mapping (this phase)

**Uzum** (`uzumSettlementOrders.status`, enum `lib/uzum/client.ts:251`):
`PROCESSING → pending` · `TO_WITHDRAW → available_to_withdraw` · `CANCELED/PARTIALLY_CANCELLED → excluded`.
No `paid`.

**Yandex** (`yandexSettlementTransactions`, aggregated `payouts.ts:183–202`):
`credits+debits present → pending` · `credits present, debits absent/partial → fees_pending`
· `no settlement txns → estimated/awaiting (filtered)`. No `paid` (deferred; also lacks an
order-level withdrawal feed). A settled-but-unwithdrawn Yandex row reads as **pending /
awaiting payout**, never "stuck" or alarming — mirroring Uzum's available-vs-pending.

---

## 3. Schema / migrations

**This phase: NONE.** Both fixes derive status at read time from columns already present
(`uzum_settlement_orders.status`, and the Yandex credit/debit split already aggregated in
`payouts.ts`). No new table, no new column, no migration, no backfill. This is the lowest-risk
possible shape and is a direct benefit of the RED verdict (the batch table is deferred).

*(The deferred Option-B schema — `uzum_payout_batches` + two `uzum_settlement_orders` columns
— is preserved in the Appendix for if/when Uzum grants payout-history access.)*

---

## 4. Computation changes (`lib/db/payouts.ts`)

### 4.1 BUG 1 — Uzum status off events (delete the calendar)

Uzum settled branch (`:342–381`):
- Remove `const isPast = monthKey < currentMonth` (`:345`) and `isPast ? 'paid':'pending'` (`:372`).
- The entry is a **monthly bucket**, so derive its status by **rolling up the per-order
  `uzumSettlementOrders.status`** in that bucket. The Uzum aggregation (`:217–255`) must also
  select each order's `status` and split the bucket net into available vs pending sub-totals.
  Roll-up rule (conservative):
  - any `TO_WITHDRAW` present → `available_to_withdraw`
  - else (all `PROCESSING`) → `pending`
  - (no `paid` path — deferred)

### 4.2 BUG 2 — Yandex partial-netting detection (unchanged by RED)

Yandex settled branch (`:274–336`):
- Keep `netPayout = settled.credit − settled.debit` (`:280`) — the row stays **visible at its
  gross-ish net** so the total doesn't mysteriously drop (owner's Option B).
- Add `feesPending = settled.credit > 0 && settled.debit === 0` (extend to "debits partial" if
  the data shows partial postings). When true, `status = 'fees_pending'`, `feesFinal = false`.
- Never flip to `paid` by calendar; past-month fees-final Yandex rows stay `pending`.

### 4.3 `PayoutsView` totals (`components/dashboard/PayoutsView.tsx:341–350`)

Move from two buckets to three:
- **Всего выплачено / paid** = sum where `status ∈ {paid, estimated_paid}`. **After this fix
  this is effectively empty on the page** (no settled row emits `paid`, and estimated rows are
  filtered out). See the UX decision below.
- **Доступно к выводу / available_to_withdraw** *(new KPI tile)* = sum where
  `status = available_to_withdraw`. The 55 550 J16 lands here (moved out of "paid").
- **Ожидает / pending** = sum where `status ∈ {pending, fees_pending, estimated_pending}`.
  `fees_pending` rows carry an "≈ fees pending / fees not final" badge and a net-cell marker;
  they **stay counted at gross** in the pending total (owner's Option B — visible + flagged).

**UX decision needed (owner):** with no provable `paid`, the "Всего выплачено / Total paid"
headline tile will read ~0 for both marketplaces. Options:
- (a) Keep the tile but let it show 0 until a payout feed exists, with "Доступно к выводу" as
  the meaningful new headline. Honest but the old top-line number disappears.
- (b) Relabel the primary tile to "Доступно к выводу" and demote "Выплачено" (or hide it until
  a feed exists).
Recommendation: **(b)** — the number sellers care about day-to-day is what's available to
withdraw; "paid" returns as a real tile once Uzum grants payout-history access.

---

## 5. The deeper structural issue (monthly-bucket grain)

The tables are already **per-order** (`uzum_settlement_orders` per order-item;
`yandex_settlement_transactions` per txn). Only `payouts.ts` collapses them to
`"YYYY-MM|marketplace"` buckets *before* deriving state — pushing month state down onto
orders, which is the mechanism behind both bugs. This fix **computes state per order and rolls
up for display** (§4.1), so it does not deepen the month-grain assumption and keeps a future
per-order `PayoutEntry` refactor (and the deferred Option-B) easy. **No new logic keys
`available`/`paid` off `monthKey`.** Rebuilding the bucketing is out of scope now.

---

## 6. Blast radius

- **Consumers of `getPayoutEntries` / `PayoutEntry`:** only `app/dashboard/payouts/page.tsx:7`
  → `PayoutsView` (grep-confirmed, no other import). Contained.
- **`PayoutEntry.status` render sites:** `StatusBadge` (`PayoutsView.tsx:66–100`) and the
  export mapping (`:366`). Add badges for `available_to_withdraw` + `fees_pending`; revise the
  KPI sums/tiles (`:341–350, 477–483`); update the export "Статус" text (`:356–366`).
- **i18n (`lib/dashT.ts` payouts block, uz/ru/en; keys near `:314, 715, 1117, 1187`):** add
  `statusAvailable` ("Доступно к выводу" / "Chiqarishga tayyor" / "Available to withdraw"),
  `statusFeesPending` ("≈ Комиссия ожидается" / … / "≈ fees pending"), and (if §4.3 option b)
  a `kpiAvailable` headline label.
- **P&L / `real-financials.ts`** reads `uzum_settlement_orders` (incl. `status`) and
  `yandex_settlement_transactions` **directly** (`:108–134`) — a separate consumer. **No schema
  change → P&L is unaffected.** (A future consistency pass could share the status mapping;
  out of scope.)
- **Telegram digest / alerts:** grep-confirmed they do **not** consume payout status or
  `netPayout`. No changes.
- **Migration + backfill:** **none.** Status is derived at read time, so historical periods
  re-derive correctly on the next page load the moment the new logic ships — no data rewrite.
- **`processing` enum value:** kept, marked deprecated in a comment (no removal → no migration,
  no risk to anything historical/external referencing it).

---

## 7. Tests

Pure-function/computation tests (no network), mirroring
`lib/marketplace-readonly-guard.test.ts` style.

**BUG 1 — available vs pending (no paid):**
1. Uzum order `status=TO_WITHDRAW` → entry `available_to_withdraw`; its net is in the
   *available* KPI, not paid. (The 55 550 J16 case.)
2. Uzum order `status=PROCESSING` → `pending`.
3. Mixed bucket (some `TO_WITHDRAW`, some `PROCESSING`) → rolls up to `available_to_withdraw`
   with the correct available/pending net split.
4. **Calendar-removal regression:** a past-month Uzum order must **not** be `paid` (asserts the
   `isPast` derivation is gone).
5. **No-paid invariant:** no settled Uzum entry is ever emitted with `status='paid'` (guards
   the deferred boundary).

**BUG 2 — Yandex partial netting:**
6. credit>0, debit=0 → `fees_pending`, `feesFinal=false`, row visible at gross net, counted in
   pending total. (The 100 000 M9 case.)
7. credit>0 and debits present → `pending`, `feesFinal=true`, fees applied.
8. Uzum control: `PROCESSING` order with commission+delivery present → fees applied
   pre-settlement (the 121172241 contrast — proves the Yandex flag is data-driven, not blanket).

**KPI totals (`PayoutsView`):**
9. Given a mix, assert the three sums (paid≈empty / available / pending incl. fees_pending) and
   that `fees_pending` rows carry the badge flag.

---

## 8. Rollout order (once approved)

1. `payouts.ts` — Uzum status off events (available/pending, no paid) + Yandex `fees_pending`
   flag. (No migration.)
2. `PayoutsView` — three-bucket KPIs (per §4.3 option), badges, export text, i18n.
3. Tests (§7).
4. **Owner action, parallel:** Uzum support ticket for finance/payout-history API access. If
   granted → build the Appendix (Option-B) as a follow-up on a fresh branch.

---

## Decisions locked (owner sign-off)

1. **Yandex `paid` deferred** — accepted. Yandex settled rows read as pending / awaiting
   payout, never calendar-`paid`; UI must not make them look stuck. Same three-state logic as
   Uzum, minus a confirmable `paid`.
2. **Reconciliation under-claim guard** — accepted (now moot for this phase since the whole
   batch path is deferred; the guard is baked into the Appendix design: ambiguous → stays
   available, never a guessed `paid`).
3. **Keep `processing`** — kept, deprecated comment, no enum removal.

**Open for sign-off:** §4.3 UX — keep an empty "Выплачено" tile (a) vs promote "Доступно к
выводу" as the headline and demote/hide "Выплачено" until a payout feed exists (b, recommended).

---

## Appendix — DEFERRED Option B (gated on Uzum granting finance-payout API access)

Build this only if Uzum grants the token's role access to a payout/withdrawal-history endpoint
(the current `403 RBAC` lifts). Preserved so the design isn't lost.

- **Signal:** ingest the "История выплат" batches, each with `batch_ext_id` (№5000…), a
  **success/failed/pending status** (the ✗ on №5000360785 is why its order stays available),
  `amount`, `date`, and — ideally — the covered order ids.
- **Schema:** `uzum_payout_batches` (id, shop_id, batch_ext_id UNIQUE, amount, status
  {completed|pending|failed}, paid_at, period_from/to nullable, covered_order_ids jsonb
  nullable, raw jsonb) + `uzum_settlement_orders.payout_batch_id` (nullable FK) +
  `payout_confirmed` (bool default false). Additive/nullable.
- **Ingestion:** a payout-history sync mirroring `settlements-sync.ts`, GET-only through the
  read guard, idempotent upsert keyed on `batch_ext_id`, wired into the existing
  `refresh-settlements` route cadence. Pending batches re-checked until they resolve.
- **Reconciliation:** Case A (feed lists covered orders) → direct link. Case B (batch-level
  only) → match a subset's `withdrawn_profit`/net to the batch `amount` within its window;
  **only a COMPLETED batch sets `payout_confirmed=true`; a FAILED batch sets nothing (order
  stays available); ambiguous amounts → leave unlinked (never guess an order into paid).**
- **Status:** adds `paid` back to the Uzum mapping (order covered by a completed batch →
  `paid`), restoring the real "Выплачено" tile.
