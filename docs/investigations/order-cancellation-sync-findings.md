# Order-cancellation sync bug — findings

**Scope:** Yandex Market + Uzum FBS order ingest, status normalisation and the
"🛒 Новый заказ! Нужно собрать и отправить" Telegram alert.
**Trigger case:** Yandex Market order `60767668482` (Повербанк MagSafe 5000 мА·ч,
SKU `PBGRY`, 115 000 сум), 24.08.2026.
**Status of this pass:** investigation only. No code, schema, migration or config
was changed. No marketplace write was issued.

---

## 0. What this pass could and could not verify

| Task | Verified how | Result |
|---|---|---|
| A — code path map | Source read | ✅ complete |
| B — ground truth for `60767668482` | **Blocked** | ⚠️ partial — see §1 |
| C — Yandex sync + mapping audit | Source read | ✅ complete |
| D — alert trigger audit | Source read | ✅ complete |
| E — Uzum FBS parity audit | Source read + spec-derived list in code | ✅ complete except the live swagger enum |

**Why B is partial.** The investigation sandbox has no `DATABASE_URL`, no `.env`,
and no marketplace credentials (the seller token only exists encrypted in the
production `shops` table). The production DB queries and the live
`getOrder` read in §1.4 are written out ready to run, but were **not executed**.
Everything asserted below without a query result is derived from source and is
labelled as such.

That limitation does **not** block the root-cause finding: the alert's own text
is reproducible from the code, byte for byte, and that alone proves which branch
emitted it (§1.2).

---

## 1. Ground truth for order `60767668482`

### 1.1 What the marketplace says

From the seller panel (screenshot 1): created **24.08.2026 10:23**, ship date
24.08.2026, warehouse *Daromadchi · Ташкент*, delivery to a Fergana PVZ, buyer
*Erkinov Aziz*. Final state **«Отменён до обработки · Покупатель не оплатил
заказ»**, item status **Отменён**.

Per the API facts in the brief, that is Yandex `CANCELLED` /
`USER_NOT_PAID` (surfaced in the stats report as `CANCELLED_BEFORE_PROCESSING`),
reached from `UNPAID` after the 30-minute PREPAID payment window elapsed.

### 1.2 What Daromadchi did — proven from the alert text itself

The Telegram message in screenshot 2 is an exact render of this code path:

```
🛒 <b>Новый заказ!</b>                     ← lib/notif-i18n.ts:174
Нужно собрать и отправить:                 ← lib/notif-i18n.ts:175

• Yandex Market: <b>1</b> новый заказ      ← lib/notif-i18n.ts:176 via app/api/cron/sync/route.ts:243
   #60767668482 — Повербанк MagSafe … (PBGRY) — 115000 so'm
                                           ← formatYmOrderLine, lib/yandex/sync.ts:26-43
Подробнее: https://daromadchi.uz/dashboard/orders
                                           ← app/api/cron/sync/route.ts:245
```

The indented detail line is produced **only** by `formatYmOrderLine`, which is
called from exactly one place:

```ts
// lib/yandex/sync.ts:529-533
for (const r of toInsert) {
  if (r.status === 'pending' || r.status === 'confirmed') {
    newOrders.push(formatYmOrderLine(r.order_id_external, r.revenue ?? 0, …))
  }
}
```

`toInsert` (line 512) is the set of orders **not already present** in our
`orders` table. So, with certainty:

> At the moment the alert fired, order `60767668482` was being **INSERTED for the
> first time** into `orders`, with normalized `status` ∈ {`pending`, `confirmed`}
> — i.e. it landed in the **Создан** or **В процессе** bucket, and the sync
> considered it fulfilment-required.

There is no other producer of that line, and no other consumer of `newOrders`
(`app/api/cron/sync/route.ts:208`).

### 1.3 Was the cancellation synced?

**Almost certainly yes, within ~5 minutes — the dashboard self-corrected; the
alert did not.** Evidence:

- Order status is re-read on **every** cron tick, not once. `syncFromYandex`
  refetches all orders created in the last 30 days (`ORDER_STATUS_LOOKBACK_DAYS`,
  `lib/yandex/sync.ts:416`) and UPDATEs every already-known row
  (`toUpdate`, lines 513, 556-566).
- The cron runs **every 5 minutes** — `*/5 * * * * … cron-runner.sh sync`
  (`.github/workflows/deploy.yml:91`). The orders leg runs on every tick
  regardless of plan; only the heavy catalog/settlement leg is plan-throttled
  (`app/api/cron/sync/route.ts:166-181`).
- `CANCELLED → cancelled` **is** mapped (`lib/yandex/sync.ts:21`), and `cancelled`
  renders as **Отменён** (`components/dashboard/OrdersTable.tsx:37-39`).
- Screenshot 3 is consistent with this: the bug order is **not** in the
  «Создан 1» bucket (that one is `60675080064`, 21/08), and there are 3 orders in
  «Отменён».

**Residual check (the one thing screenshot 3 cannot settle):** the 3 orders in
«Отменён» could all be Uzum. If Yandex's `GET /v2/campaigns/{id}/orders` omits
`CANCELLED` orders from an unfiltered response — the code passes no `status`
filter (`lib/yandex/client.ts:225-240`) — the row would be frozen at `pending`
forever, and H2 would be live for Yandex as well. §1.4 settles it in one query.

### 1.4 Queries to run (read-only) — NOT YET EXECUTED

```sql
-- 1. Where does the bug order actually sit?
--    NOTE: this schema has NO substatus / payment_type / status_updated_at /
--    synced_at / alert_sent_at columns. See §5. Do not adapt those in — they
--    do not exist.
SELECT o.id, o.marketplace, o.order_id_external, o.status, o.marketplace_status,
       o.fulfillment_type, o.revenue, o.items_count, o.ordered_at, s.name AS shop
FROM orders o JOIN shops s ON s.id = o.shop_id
WHERE o.order_id_external = '60767668482';

-- 2. What do the orders Daromadchi DOES show as Отменён look like,
--    and are any of them Yandex? (settles the §1.3 residual)
SELECT marketplace, status, marketplace_status, count(*)
FROM orders
WHERE status IN ('cancelled', 'returned')
GROUP BY 1, 2, 3;

-- 3. Any order sitting in Создан/В процессе on a raw status we never mapped?
--    (this is the fleet-wide blast radius of the default-to-pending fall-through)
SELECT marketplace, marketplace_status, status, count(*)
FROM orders
WHERE status IN ('pending', 'confirmed')
GROUP BY 1, 2, 3
ORDER BY 1, 4 DESC;
```

Expected result for query 1 if the diagnosis in §1.3 holds:
`status = 'cancelled'`, `marketplace_status = 'CANCELLED'`.
If instead it returns `status = 'pending'` with `marketplace_status` of
`'UNPAID'` (or `'PROCESSING'`), H2 is confirmed for Yandex and the fix set in §6
grows by option (d).

**Live API read (read-only, GET) to run alongside:**

```
GET https://api.partner.market.yandex.ru/v2/campaigns/{campaignId}/orders/60767668482
Authorization: Bearer <decrypted shops.api_key_encrypted>
```

Record `order.status`, `order.substatus`, `order.paymentType`, `order.creationDate`,
`order.updatedAt`. Then repeat the *list* call the sync actually uses —
`GET /v2/campaigns/{campaignId}/orders?page=1&pageSize=50&fromDate=2026-07-25` —
and check whether `60767668482` appears in it at all. **That second call is the
decisive one**: it is the only order-status source in the product, and if a
cancelled order is absent from it, no amount of mapping work will fix the
dashboard.

### 1.5 Alert log — there isn't one

There is **no** alert/notification log table, and **no** `alert_sent_at` /
`notified` column on `orders` (`lib/db/schema.ts:257-281`; no migration adds one —
`grep 'ALTER TABLE orders'` over `migrations/migrations/` returns only
`fulfillment_type`, the WB fee columns and `marketplace_status`). So "what status
did the order have when the alert fired?" cannot be answered from stored data —
only from §1.2's code proof and from the app log.

The nearest available evidence is the pm2 app log on the VPS
(`pm2 logs daromadchi`, `~/.pm2/logs/daromadchi-out.log`), which will contain, if
the order arrived as `UNPAID`:

```
[SYNC WARNING] Unmapped Yandex order status: "UNPAID" for order 60767668482. Defaulting to pending.
```

(emitted at `lib/yandex/sync.ts:482`). **Grep for that line around 24.08.2026
05:20–05:40 UTC.** Its presence pins the raw status at alert time exactly; its
absence means the order arrived as `PROCESSING` and the alert is still premature,
just for the H1 reason rather than the H1+H3 reason.

### 1.6 Timeline

| Time | Event | Source |
|---|---|---|
| 24.08 10:23 (Tashkent, UTC+5) | Order placed, PREPAID, unpaid | seller panel |
| ≤ 5 min later | Next `*/5` cron tick; order returned by `GET /campaigns/{id}/orders`; not in `orders` → INSERT; `status` = `pending`; pushed to `newOrders` | `deploy.yml:91`, `yandex/sync.ts:512, 529-533` |
| same tick | Telegram alert sent | `cron/sync/route.ts:217-249` |
| 10:23 + 30 min | Yandex auto-cancels — `CANCELLED` / `USER_NOT_PAID` | brief §3 |
| ≤ 5 min after that | Next tick UPDATEs the row to `cancelled` (assuming the list endpoint returns it) | `yandex/sync.ts:556-566` |
| — | **No follow-up, retraction or correction is ever sent** | no such code exists |

**Unresolved:** the Telegram screenshot shows `3:25`, which reconciles with
neither 10:25 Tashkent nor 05:25 UTC. It is a client-side display timezone, not
server truth. The pm2 log grep in §1.5 gives the real fire time; the code
guarantees it was within one 5-minute tick of the order first appearing in the
API, whatever the wall clock said.

---

## 2. Hypotheses — confirmed / killed

| # | Hypothesis | Verdict | Deciding evidence |
|---|---|---|---|
| **H1** | Premature alert on unconfirmed/unpaid orders | **CONFIRMED** | `lib/yandex/sync.ts:529-533` and `lib/uzum/sync.ts:643-647` — the alert gate is `status === 'pending' \|\| status === 'confirmed'` on the *normalized* enum, evaluated at INSERT. Nothing reads payment state, substatus, or a fulfilment-required whitelist. |
| **H2** | Cancellation never re-synced (one-shot ingest) | **KILLED as a general defect; one residual** | Both syncs re-poll and UPDATE existing rows on every 5-min tick — Yandex `yandex/sync.ts:513, 556-566` over a 30-day creation-date lookback (`:416`); Uzum `uzum/sync.ts:613, 670-679` over an *unwindowed* per-status sweep. Residual: whether the Yandex list endpoint returns `CANCELLED` at all (§1.3) — settle with §1.4 query 2. Separate residual for Uzum: `fbsStatuses = specEnum.slice(0, 20)` (`uzum/sync.ts:456`) silently truncates a longer live enum; if `CANCELED`/`RETURNED` fell past index 20, Uzum cancellations would stop syncing with no error. |
| **H3** | Substatus mapping gap | **CONFIRMED, but not where expected** | `substatus` is **never read** from any order payload — `YandexOrder` (`lib/yandex/client.ts:88-98`) has no such field and the column does not exist. But the top-level `CANCELLED` **is** mapped correctly, so the substatus omission is not what broke the cancel. The real mapping gap is on the *other* side: **`UNPAID` is absent from `STATUS_MAP` and falls through to `'pending'`** (`lib/yandex/sync.ts:16-23, 481-485`) — i.e. an unpaid order is presented to the alert gate as a fulfilment-required order. |
| **H4** | Stale data source (`getOrdersStats`, ≤40-min lag) | **KILLED** | `getOrdersStats` is not used anywhere. Order status comes exclusively from the real-time `GET /v2/campaigns/{campaignId}/orders` (`lib/yandex/client.ts:225-240`, `:524-539`). The only `stats` call in the codebase is `fetchAllYandexSkuStats` (`client.ts:456`), which feeds product metrics, not orders. |
| **H5** | No alert dedup / gating | **CONFIRMED for gating and reconciliation; dedup exists implicitly** | Dedup: an order is only in `toInsert` on the tick that first inserts it, so a normal duplicate cannot occur — but it is *structural*, not recorded, so `clearShopData()` (`lib/uzum/sync.ts:246`, fired on an Uzum account switch) re-inserts every order and would re-alert the lot. Gating on status: absent (H1). **Reconciliation: entirely absent** — no code path anywhere sends a follow-up when an already-alerted order later cancels. `grep`ing the notification layer finds only the daily digest's cancelled *tally* (`lib/telegram-digest.ts:132-133, 181-182`). |

**Combined answer to the brief's headline question:** the alert was
**premature**, and the cancellation **was** (very probably) synced — the
dashboard healed itself within ~5 minutes while the seller was left holding a
Telegram message telling them to pick and ship an order that no longer existed,
with nothing ever correcting it.

---

## 3. Code path map: ingest → normalise → persist → alert

### Yandex Market

| Stage | Location |
|---|---|
| Cron entrypoint | `app/api/cron/sync/route.ts:132` (`GET`), auth on `CRON_SECRET` `:136` |
| Schedule | `*/5 * * * *` — `.github/workflows/deploy.yml:91`; runner `:79`. (`scripts/crontab.example` says `*/15` and is explicitly marked unverified.) |
| Per-shop dispatch | `app/api/cron/sync/route.ts:50` `syncShop()`; heavy/light decision `:173-181` |
| Ingest | `lib/yandex/sync.ts:439` → `fetchAllYandexOrders` → `lib/yandex/client.ts:524` → `:225` `GET /v2/campaigns/{id}/orders?page&pageSize&fromDate` |
| Window | `:416` 30-day creation-date lookback (365 on first sync) |
| Normalise | `lib/yandex/sync.ts:16-23` `STATUS_MAP`; applied `:481-485` with `?? 'pending'` fall-through |
| Persist | insert `:535-552` (`onConflictDoNothing`), update `:556-566` |
| **Alert gate** | `:529-533` — `toInsert` ∧ (`pending` ∨ `confirmed`) → `newOrders[]` |
| Fan-out | `app/api/cron/sync/route.ts:206-215` collects `newOrders`, skips shops with `last_synced_at === null` (`:211`, backfill guard) |
| Send | `:217-249`, gated on `userSettings.notif_new_orders` (default **true**, `lib/db/schema.ts:392`) and a linked `telegram_chat_id`; renders via `lib/telegram-seller.ts` → `lib/notif-i18n.ts:174-178` |

### Uzum FBS

| Stage | Location |
|---|---|
| Ingest | `lib/uzum/sync.ts:465-484` — one `GET /v2/fbs/orders?status=…` sweep **per status**, merged by id; **no date window at all**; paging capped at 50 pages × 50 (`fetchAllPages`, `lib/uzum/client.ts:734`) |
| Status list | `:449-460` — live enum from `GET /swagger/api-docs` (`client.ts:363`), 6 h process cache, `.slice(0, 20)`; falls back to the static `FBS_STATUSES` (`:92-97`) |
| Extra source | `:486-517` — `GET /v1/invoice`; any order-shaped record not already seen is merged in **verbatim, including whatever `status` it carries (or none)** |
| FBO | `:520-541` — same sweep, but always over the **static** `FBS_STATUSES`, never the spec enum |
| Normalise | `:47-77` `STATUS_MAP`; applied `:585-590` with the same `?? 'pending'` fall-through |
| Persist | insert `:650-667`, update `:670-679` |
| **Alert gate** | `:643-647` — identical predicate to Yandex |

### Shared

`lib/db/schema.ts:257-281` (`orders`), `components/dashboard/OrdersTable.tsx:33-41`
(bucket rendering), `lib/marketplace/reserving-orders.ts` +
`lib/marketplace/stock-allocation.ts:49-55` (`RESERVING_RAW_STATUSES`, the raw-status
predicate the stock draw-down uses).

**Note on the webhook:** `app/api/marketplace/yandex/notifications/route.ts` is
*not* an order-status path. A verified notification only triggers
`syncStockSyncGroups` (`:161`); it never touches the `orders` table. The 5-minute
poll is the sole order-status source in the product.

---

## 4. Complete current status-mapping tables

### 4.1 Yandex Market — `lib/yandex/sync.ts:16-23`

| Yandex `status` | → internal | Dashboard bucket | Fires "collect & ship" alert on insert? | |
|---|---|---|---|---|
| `PENDING` | `pending` | Создан | **YES** | mapped |
| `PROCESSING` | `pending` | Создан | **YES** | mapped — correct to alert (this is the real fulfilment state) |
| `DELIVERY` | `confirmed` | В процессе | **YES** | mapped |
| `DELIVERED` | `delivered` | Доставлен | no | mapped |
| `CANCELLED` | `cancelled` | Отменён | no | mapped |
| `RETURNED` | `returned` | Отменён | no | mapped |
| **`UNPAID`** | **`pending`** | **Создан** | **YES** | 🔴 **UNMAPPED — this is the bug.** A PREPAID order the buyer has not paid for is presented as ready to pick and ship. |
| **`PLACING`** | **`pending`** | **Создан** | **YES** | 🔴 unmapped — a draft order |
| **`RESERVED`** | **`pending`** | **Создан** | **YES** | 🔴 unmapped — reserved, not confirmed |
| **`PICKUP`** | **`pending`** | **Создан** | **YES** | 🔴 unmapped — order is *already at the pickup point*; showing it as «Создан» is wrong in the opposite direction. Note `PICKUP` **is** listed in `RESERVING_RAW_STATUSES` (`stock-allocation.ts:54`), so stock reserves correctly off the raw value while the dashboard bucket is wrong. |
| *anything else* | `pending` | Создан | **YES** | 🔴 fall-through, `console.warn` only |

**Substatus:** not requested, not parsed, not stored. `USER_NOT_PAID`,
`CANCELLED_BEFORE_PROCESSING`, `STARTED`, `READY_TO_SHIP` are all invisible to
the app. Consequently the app cannot today distinguish `PROCESSING/STARTED`
(confirmed, may begin) from `PROCESSING/READY_TO_SHIP` (packed) — nor tell a
buyer-cancel from a shop-cancel.

**Payment type:** `paymentType` (PREPAID / POSTPAID) is not requested, not
parsed, not stored. There is no `payment_type` column.

### 4.2 Uzum FBS — `lib/uzum/sync.ts:47-77`

| Uzum status | → internal | Bucket | Alerts? | |
|---|---|---|---|---|
| `CREATED` | `pending` | Создан | **YES** | ✅ correct — seller must pack |
| `PACKING`, `PENDING_DELIVERY` | `pending` | Создан | **YES** | ✅ |
| `NEW`, `PENDING`, `CONFIRMED`, `AGREED`, `ACCEPTED`, `PACKED`, `PACKAGED`, `ASSEMBLED`, `READY`, `PROCESSING`, `IN_PROGRESS` | `pending` | Создан | **YES** | defensive aliases, not in the spec enum |
| `DELIVERING` | `confirmed` | В процессе | **YES** | ✅ |
| `ACCEPTED_AT_DP` | `confirmed` | В процессе | **YES** | ✅ |
| `SENT`, `HANDED_OVER`, `TRANSFERRED`, `ON_DELIVERY`, `ACTIVE` | `confirmed` | В процессе | **YES** | defensive aliases |
| `DELIVERED_TO_CUSTOMER_DELIVERY_POINT`, `DELIVERED`, `COMPLETED` | `delivered` | Доставлен | no | ✅ |
| `CANCELED`, `CANCELLED`, `PENDING_CANCELLATION`, `EXPIRED` | `cancelled` | Отменён | no | ✅ both spellings covered |
| `RETURNED` | `returned` | Отменён | no | ✅ |
| **any status in the live swagger enum not listed above** | **`pending`** | **Создан** | **YES** | 🟠 same fall-through as Yandex. Every one of the 11 statically-swept statuses is mapped, so this only bites when the live spec enum introduces a new value — which the sweep *will* then query and ingest. |
| **an invoice record with a missing or foreign `status`** | **`pending`** | **Создан** | **YES** | 🟠 `uzum/sync.ts:486-517` merges `/v1/invoice` records with no status vocabulary check; `STATUS_MAP[undefined]` → `'pending'` → alert. |

**Uzum-specific quirks vs Yandex:**
- No substatus concept — one flat status, so nothing analogous to
  `CANCELLED/USER_NOT_PAID` needs mapping. Uzum expresses "cancelling" as its own
  status (`PENDING_CANCELLATION`), already mapped.
- No unpaid/awaiting-payment state in the FBS vocabulary — Uzum FBS is
  overwhelmingly pay-on-pickup, so **the exact 60767668482 failure mode
  (alert on an unpaid PREPAID order) has no direct Uzum analogue.** The parity
  risk is the shared *shape* of the defect: an ungated alert on a
  default-to-`pending` fall-through, plus the unvalidated invoice source.
- The sweep is unwindowed (no `dateFrom`/`dateTo`), so status re-sync coverage is
  broader than Yandex's — bounded only by the 2 500-row-per-status page cap and
  the `slice(0, 20)` enum truncation.
- No auto-cancel window equivalent to Yandex's 30-minute PREPAID timeout.

---

## 5. Root causes

**RC-1 (primary) — the alert has no fulfilment-required gate.**
`lib/yandex/sync.ts:529-533` and `lib/uzum/sync.ts:643-647` both gate on the *normalized*
`pending | confirmed` enum. That enum is a **display** bucket — it collapses
"unpaid draft", "confirmed, pack it" and "already in transit" into two values —
so it cannot express "this order needs picking". Nothing consults payment state,
substatus, or a positive whitelist of fulfilment-required raw statuses.

**RC-2 (primary, Yandex) — `?? 'pending'` fall-through on an unmapped status.**
`lib/yandex/sync.ts:482`. `UNPAID` (and `PLACING`, `RESERVED`, `PICKUP`) are not
in `STATUS_MAP`, so they are *silently upgraded* into the most actionable bucket
the app has. Defaulting an unknown state to the "needs action" end of the
lifecycle is backwards: an unrecognised status should be inert, not
alert-worthy. Same construct exists at `lib/uzum/sync.ts:588`.

**RC-3 (secondary, both) — no reconciliation after an alert.**
The alert is fire-and-forget. Once `newOrders` is sent there is no record that it
was sent and no path that reacts to the subsequent `pending → cancelled`
transition. The system is capable of noticing the cancel (it UPDATEs the row) and
simply does nothing with the observation.

**RC-4 (data model) — the schema cannot represent what the gate needs.**
`orders` (`lib/db/schema.ts:257-281`) has no `substatus`, no `payment_type`, no
`status_updated_at`, and no alert-sent marker. RC-1 and RC-3 cannot be fixed
*well* without at least the last one.

**RC-5 (Uzum, latent) — unvalidated ingest sources.**
`fbsStatuses.slice(0, 20)` (`uzum/sync.ts:456`) can silently truncate the live
enum, and the `/v1/invoice` merge (`:486-517`) accepts records whose `status` is
absent or outside the FBS vocabulary. Both funnel into RC-2's fall-through.

### Blast radius beyond this one order

RC-2 means **every** Yandex order that has ever been in `UNPAID`, `PLACING`,
`RESERVED` or `PICKUP` at the moment of a sync tick was inserted as «Создан» and
alerted. §1.4 query 3 sizes this. Orders currently sitting at raw `PICKUP` are
additionally *mis-bucketed right now* in the dashboard.

---

## 6. Fix options (described, not implemented)

### (a) Gate the alert on a fulfilment-required whitelist — **recommended, do first**

Replace the `pending | confirmed` predicate with a positive, raw-status
whitelist, in the same spirit as the existing `RESERVING_RAW_STATUSES`
(`lib/marketplace/stock-allocation.ts:49`) — a shared constant both syncs import,
so they cannot drift:

- Yandex: alert only on `PROCESSING` (optionally narrowed to substatus
  `STARTED` / `READY_TO_SHIP` once (c) lands). Never `UNPAID`, `PLACING`,
  `RESERVED`, `CANCELLED`, or an unknown value.
- Uzum: alert only on `CREATED`, `PACKING`, `PENDING_DELIVERY`.

**Files:** new `lib/marketplace/fulfillment-statuses.ts`;
`lib/yandex/sync.ts:529-533`; `lib/uzum/sync.ts:643-647`.
**Blast radius:** the Telegram alert only. Dashboard, stock, P&L and payouts are
untouched — none of them read `newOrders`.
**Risk:** low, and asymmetric in the right direction. Worst case is a *missed*
alert if a real fulfilment status is left off the whitelist; mitigate by keeping
Uzum's defensive aliases and logging every raw status that is ingested but not
whitelisted, so a gap is visible in one sync cycle.
**Fixes:** RC-1. Alone, this closes the reported bug.

### (b) Stop defaulting unmapped statuses to `pending`

Make the fall-through inert instead of actionable. Two shapes: add the missing
Yandex keys explicitly (`UNPAID`/`PLACING`/`RESERVED` → a non-actionable bucket,
`PICKUP` → `confirmed`), and/or change `?? 'pending'` so an unknown status is
never alert-eligible.

**Files:** `lib/yandex/sync.ts:16-23, 481-485`; `lib/uzum/sync.ts:47-77, 585-590`.
**Blast radius:** larger than it looks. `orders.status` feeds the dashboard
buckets, `lib/telegram-digest.ts:132`, `lib/db/pnl.ts`, `lib/db/payouts.ts`,
turnover → **billing tier**. Mapping `UNPAID` to a bucket other than `pending`
changes counts on those surfaces. Adding a 6th enum value would need a migration
and a sweep of every consumer.
**Risk:** medium. Do it *after* (a), as its own branch, and decide deliberately
whether an unpaid order should be counted anywhere at all.
**Fixes:** RC-2, RC-5's downstream half.

### (c) Capture `substatus` + `paymentType`

Request and persist them (`YandexOrder` in `lib/yandex/client.ts:88-98`, two new
nullable columns + migration, both syncs).

**Files:** `lib/yandex/client.ts`, `lib/db/schema.ts`, new migration,
`lib/yandex/sync.ts`.
**Blast radius:** additive — nullable columns nothing reads yet.
**Risk:** low mechanically. Only worth doing as the enabler for a substatus-precise
(a) and for distinguishing buyer-cancels from shop-cancels in reporting. Not
required to fix the reported bug.
**Fixes:** RC-4 (partly), sharpens (a).

### (d) Switch/augment the Yandex data source — **conditional; do NOT do speculatively**

Only if §1.4 query 2 shows the list endpoint does not return `CANCELLED` orders.
Remedy would be a per-order `GET /v2/campaigns/{id}/orders/{orderId}` for rows
still open past a threshold — real-time, no 40-minute stats lag.

**Files:** `lib/yandex/client.ts`, `lib/yandex/sync.ts`.
**Blast radius:** N extra GETs per tick against the Partner API rate limit.
**Risk:** medium (rate limit). **Explicitly not warranted unless the query says
so** — the current source is already the real-time one, so this would otherwise
be cost for nothing.

### (e) Reconciliation + "заказ отменён" follow-up

Add `orders.alert_sent_at` (migration), set it where `newOrders` is emitted, and
on the tick where an alerted order transitions to `cancelled`/`returned`, send a
correction message.

**Files:** migration, `lib/db/schema.ts`, both syncs,
`app/api/cron/sync/route.ts`, `lib/notif-i18n.ts` (3 languages).
**Blast radius:** new Telegram traffic. Needs its own `notif_*` preference and a
dedup guard, or a flapping status becomes a message storm.
**Risk:** medium. Highest *seller-perceived* value after (a) — it converts a
silent lie into an explicit correction — but it is a feature, not a bug fix.
**Fixes:** RC-3, RC-4.

### (f) Uzum ingest hardening

Drop or raise `slice(0, 20)` (`uzum/sync.ts:456`) — or log when the live enum is
longer than the cap; validate `/v1/invoice` records against the known status
vocabulary before merging; use the spec enum for the FBO sweep too (`:525`).

**Files:** `lib/uzum/sync.ts`.
**Blast radius:** Uzum order ingest only.
**Risk:** low. Small, self-contained, worth doing.
**Fixes:** RC-5.

---

## 7. Recommendation and branch plan

Run §1.4's three queries and the pm2 grep **before** cutting the first fix
branch — they cost minutes and they decide whether (d) is in scope at all.

One change per branch, in this order:

| # | Branch | Content | Why here |
|---|---|---|---|
| 1 | `fix/new-order-alert-fulfillment-gate` | Option **(a)** | Closes the reported bug on both marketplaces. Smallest blast radius of any candidate — alert-only, nothing else reads `newOrders`. Ship alone. |
| 2 | `fix/uzum-order-ingest-hardening` | Option **(f)** | Independent, low risk, removes a silent-truncation failure mode before it bites. |
| 3 | `fix/yandex-status-map-completeness` | Option **(b)** | Needs a deliberate decision on where `UNPAID` and `PICKUP` sit for P&L/turnover/**billing tier**. Do not bundle with 1. |
| 4 | `feat/order-substatus-payment-type` | Option **(c)** | Additive; enables a substatus-precise gate. |
| 5 | `feat/order-cancel-followup-alert` | Option **(e)** | Depends on the `alert_sent_at` column; a product decision (new notification type + preference), not a bug fix. |
| — | *(conditional)* `fix/yandex-order-status-realtime` | Option **(d)** | **Only** if §1.4 query 2 proves the list endpoint hides cancelled orders. |

Branch 1 is the whole fix for what was reported. Everything after it is
hardening, correctness of adjacent surfaces, or product work.

---

## 8. Compliance note

Read-only pass throughout, consistent with `AGENTS.md`. No marketplace API was
called. No `PUT`/`PATCH`/`DELETE` was issued or proposed: none of the options in
§6 add a marketplace write, and the two sanctioned write paths
(`lib/marketplace/stock-writer.ts`, `lib/marketplace/order-cancel.ts`) are
untouched by every option above.

One adjacent observation worth recording, out of scope for this brief:
the oversell auto-cancel path (`lib/marketplace/oversell.ts:197` →
`cancelOrder`) selects its victim from orders reserving physical stock. That
predicate keys off `RESERVING_RAW_STATUSES` (raw `ACCEPTED_AT_DP`, `HANDED_OVER`,
`TRANSFERRED`, `DELIVERY`, `PICKUP`) via `lib/marketplace/reserving-orders.ts`, so
a phantom `UNPAID` order — which normalizes to `pending` and carries raw
`UNPAID` — does **not** qualify and cannot be auto-cancelled. The raw-status
keying is doing exactly the job it was introduced for. Recorded because RC-2
would have made this dangerous had the predicate used the normalized enum.
