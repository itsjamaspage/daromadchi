# Payouts settlement-accuracy — implementation plan

Branch: `fix/payouts-settlement-accuracy` (off clean `main`). Separate from
`fix/fbs-stock-sync-ledger` and unrelated to ATMOS — neither is touched.

**Status: SHIPPED for Yandex, CLOSED for Uzum — investigation over.** See §9 for what
live data settled, including two readings in this document's own history that turned
out to be wrong. §9.5 is the final word on Uzum, and it rests on Uzum's own OpenAPI
document rather than on inference: **the seller API has no payout resource at all.**
Not a permission we lack — a feature that does not exist. Nothing further is
buildable and nothing further should be attempted in code. Verbatim evidence:
`docs/evidence/uzum-seller-openapi-finance.md`.

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

~~**This is "deferred pending API access", NOT "impossible forever."** Because the denials are
`403 RBAC` (permissions) rather than `404`, Uzum may be able to grant finance-payout API
access to the token's role. Action item (owner): open a support ticket with Uzum requesting
finance/payout-history API scope. If granted, the deferred Option-B design in the Appendix
becomes buildable.~~

> **SUPERSEDED by §9.5.** Reading Uzum's full OpenAPI document showed the inference above
> was wrong: the `403` is not a permission denial on an endpoint that exists, it is the
> gateway answering for a route that does not exist. There is no scope to request. The
> ask is whether Uzum plans to build a payout API at all. Left in place because the
> `403`-means-permissions inference is a reasonable one to make twice.

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
· `no settlement txns → estimated/awaiting (filtered)`. A settled-but-unwithdrawn Yandex row
reads as **pending / awaiting payout**, never "stuck" or alarming — mirroring Uzum's
available-vs-pending.

> **SUPERSEDED for `paid`.** This section said Yandex lacks an order-level withdrawal feed.
> It does not: the netting report's payment-order number IS one, per order. `paid` is emitted
> now — see §9.1. The Uzum half of this mapping still stands exactly as written, and §9.2
> records why it cannot change.

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

## 9. Live-data findings (2026-08-20) — what is settled, and what is dead

Everything below is measured against one real seller's data across three
independent sources: the Yandex united-netting report, the Uzum seller panel, and
the bank account that received the money. No inference from a single figure.

### 9.1 Yandex — SOLVED, per order, via the payment-order number

Ran `parseNettingReport` over the real report (period 01.06–20.08). Eight
transactions, two orders:

```
59564845443  Начисление  +76 000  «Переведён по графику выплат»       п/п 92735   TRANSFERRED
59564845443  Удержание    −2 000  «Удержан из платежей покупателей»   п/п 92735
59564845443  Удержание   −14 060  «Удержан из платежей покупателей»   п/п 92735
60137441539  Начисление +100 000  «Будет переведён по графику выплат»     —       awaiting
60137441539  Удержание ×4 −27 000 «Будет удержан из платежей…»            —

→ 59564845443  net 59 940  PAID     (bank: 59 940 from ООО «YGO UB», 5 Aug)
→ 60137441539  net 73 000  pending
```

Two things this proves, both of which had been open questions:

1. **Zero transferred rows lack an order number.** Every п/п sits on a row
   carrying its own «Номер заказа», so per-order attribution works on real data
   and needs no fallback for order-less transfer rows.
2. **A bucket-level "every row transferred" rule would still be wrong.** Order
   59564845443 has one transferred row and two deduction rows whose status text
   («Удержан из платежей покупателей») contains no transfer wording at all. Only
   the per-order rule marks it paid.

### 9.2 Uzum — no settlement signal exists. Both candidates are dead.

> Superseded in scope by **§9.5**, which closes the three remaining ways this
> conclusion could still have been wrong. 9.2 is the first two candidates; 9.5
> is the complete list.

| Candidate | Result | Evidence |
|---|---|---|
| payout-history endpoint | **403 RBAC** | every path probed; §0 |
| `withdrawnProfit` field | **always `0.00`** | both orders read `0.00` and `TO_WITHDRAW` after their payouts had landed in the bank |

`withdrawnProfit` was the promising one — it is the natural Uzum equivalent of a
Yandex п/п, it is already ingested, and `payouts.ts` already prefers it when
computing net. It is simply never populated. Checked against orders 121172241 and
117751391 on 2026-08-20, after batches №5000390691 (50 300, 14.08) and
№5000404101 (83 000, 19.08) had both completed and both credits had appeared in
the bank. Still `0.00`.

**Do not wire it.** A field that reads zero for money already received is not a
settlement signal, and treating it as one would put Uzum orders permanently in
"not paid" while looking like it worked.

The seller panel *does* show the batch history with success/failure marks
(№5000404101 ✓, №5000390691 ✓, №5000360785 ✗). The data exists; the API withholds
it. That single access grant is the only thing between this and full accuracy —
the Appendix design is ready to build the day it lands.

### 9.3 RETRACTED — the "5 250 delivery-fee gap" was a false pattern

An earlier reading of this data claimed Uzum paid 50 300 against an order worth
55 550, and that the 5 250 difference — exactly one `logistic_delivery_fee` —
meant the fee was being deducted twice. **It does not. Uzum batches payouts by
schedule, not by order**, and once the third batch landed the totals reconciled
to the so'm:

```
orders «К выводу»    :  77 750 + 55 550           = 133 300
batches COMPLETED    :  50 300 (14.08) + 83 000 (19.08) = 133 300
```

Batch №5000360785 (55 550) failed on 06.08 and its money was re-issued across the
two later batches, which is why no single batch matches any single order. The
arithmetic was never wrong; the mapping assumption was. Recorded here because the
subtraction is genuinely seductive — 55 550 − 5 250 = 50 300 — and the next person
to look at one batch in isolation will find it again.

### 9.4 The honest ceiling, until the RBAC ticket resolves

- «Всего выплачено» shows **Yandex only**. For this seller: 59 940.
- Uzum's 133 300 is reported as **earned**, with "Uzum does not report
  withdrawals" stated on the tile — not as "available to withdraw", which claimed
  the money was still unwithdrawn when part of it was already in the bank.
- Nothing claims a transfer it cannot prove, in either direction.

**Owner action, not a code task:** chase the Uzum finance-payout API scope. It is
the only remaining blocker, and it is on Uzum's side.

### 9.5 FINAL — Uzum's API has no payout resource, per Uzum's own spec

§9.2 concluded that no settlement signal exists. It was right, but it rested on
absence of evidence: candidates had been tried and had failed. Three explanations
for that failure remained open, each of which would have meant the signal was
there and we were the ones missing it —

1. a status value Uzum sends that we never request,
2. a withdrawal row in `/v1/finance/expenses`, a path in our spec we never read,
3. a payout endpoint needing POST for a read, never actually attempted because
   the read-only guard rejected it locally and the rejection read like a denial.

`scripts/probe-uzum-payout-surface.ts` (merged in #251) settles all three. Run on
the VPS 2026-08-20; results below are from the owner's run.

| # | Check | Result | Verdict |
|---|---|---|---|
| 1 | Full OpenAPI spec: every path + the declared finance status enum | `missingFromOurs: []` — the four statuses we send ARE the complete enum. 14 keyword-matched paths, none new — and of those, only **2** are Finance-tagged (the other 12 are delivery notes) | **No hidden `WITHDRAWN`/`PAID` state.** Dead |
| 2 | `GET /v1/finance/expenses` | 0 rows | **No withdrawal signal.** Dead |
| 3 | Every payout candidate | `403` from Uzum, and absent from the spec — no POST variant declared to try | **No such resource exists.** Dead |

#### CORRECTED — it is not a permission, it is an absent feature

The first reading of check 3 was wrong and is corrected here rather than quietly
dropped. Seeing `403` on paths that were absent from the spec, this document
concluded the endpoints existed server-side and our token's role was refused —
"a permission grant we do not hold".

Reading Uzum's full OpenAPI document settles it differently. **There is no
role-scoped surface. That document is the seller API, and it contains no payout
resource at all.** The whole API is 35 paths in 8 tags; the Finance tag holds
exactly two, `/v1/finance/orders` (sales) and `/v1/finance/expenses` (service
charges). The `403` on `/v1/finance/payments`, `/payouts`, `/withdrawals` and
the rest is the gateway answering for a route that does not exist — not a
permission boundary. And where Uzum *does* gate by permission it says so: the
403 on `/v3/fbs/sku/stocks` names `SKU_READ`. `SKU_READ` and `SKU_UPDATE` are
the only permissions the document names, both on stock. No finance permission is
named anywhere, because there is no finance resource for one to gate.

This changes the ask, which is why the correction matters: not "grant our token
a scope" — there is no scope to grant — but "do you plan to expose payout data
by API at all". Today Uzum does not have it to expose. «История выплат» in the
seller panel comes from a system this API does not publish.

`TO_WITHDRAW` — "к выводу средств", *for* withdrawal — is the last state the API
defines. There is no WITHDRAWN, PAID or COMPLETED to wait for. An order sits
there whether its money is still with Uzum or already in the seller's bank, and
nothing in this API distinguishes the two.

Verbatim excerpts — the tag list, both finance summaries, the `SellerPaymentDto`
enums, the two `withdrawnProfit` definitions, the status enum and the `SKU_READ`
403 — are in `docs/evidence/uzum-seller-openapi-finance.md`.

#### Everything now ruled out, in one place

| Candidate | Status | Where |
|---|---|---|
| payout-history endpoint | not in the API at all — no payout resource, no payout tag | §9.5, evidence §1 |
| `withdrawnProfit` field | spec: "прибыль после вычета" — an order accounting field, never a bank signal; `0.00` throughout | §9.2, evidence §3 |
| a status we never requested | enum is closed at four; `TO_WITHDRAW` is the last state the API defines | §9.5, evidence §4 |
| `/v1/finance/expenses` | 0 rows, and its DTO has no batch id and no failed state | §9.5, evidence §2 |
| POST-for-read on payout paths | no POST declared on any of them | §9.5 |
| `dateIssued` as a weaker signal | cannot distinguish issued-and-paid from issued-and-**failed** (№5000360785) | §9.5 |
| matching orders to batches by amount + date | provably unsafe — batches are by schedule, and a failed batch re-issues across later ones | §9.3 |

The last two deserve their emphasis: both would have produced a "Выплачено" badge
on money that never arrived. Batch №5000360785 failed, and any signal that cannot
see a failure cannot certify a payment.

#### What is NOT being built, deliberately

The seller panel does show the batch history with ✓/✗ marks, authenticated by the
seller's browser session rather than the API token — and the Chrome extension is
already injected on `seller.uzum.uz` (it returns early at `content.js:5`), so the
access to reach it exists. **This was considered and rejected by the owner.** It
is an undocumented internal API, it puts a settlement-critical dependency on an
extension and a logged-in browser, and it carries ToS risk to the seller's own
account — all to earn a cosmetic badge. Recorded so it is not rediscovered and
mistaken for an unexplored idea.

#### The only unblock

Owner action, not a code task — and, per the correction above, a different ask
than this document first recorded. There is no scope to request. The question
for Uzum support is whether they intend to expose payout/settlement data by API
at all. On today's spec they have nothing to grant.

If they ever ship it, re-run the probe — it is the verification tool for exactly
this, and its output says what became visible:

```
set -a; . ./.env; set +a
npm run probe:uzum-payout > /tmp/uzum-probe.json
```

Check 1's `financePaths` will list any newly-exposed payout path — today it is
two — and check 3 will classify its POST as read or mutation from the spec's own
`operationId` before anything is allowlisted. Only then does the deferred Option
B in the Appendix become buildable. Until it does, the app's current behaviour — «Заработано» plus
"Uzum не сообщает о выводах" — is not a placeholder to improve on. It is the
correct and complete answer to what Uzum's API reports. The limitation is
Uzum's, not Daromadchi's.

## Appendix — DEFERRED Option B (gated on Uzum BUILDING a payout API; see §9.5)

Build this only if Uzum ships a payout/withdrawal-history endpoint. Per §9.5 no such
resource exists in the seller API today, so this is gated on Uzum building one — not on
a permission being granted. Preserved so the design isn't lost.

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
