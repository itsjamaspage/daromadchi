# Does the Yandex sync ingest FBY orders? — findings

**Question:** Daromadchi is meant to serve FBS *and* FBY sellers. No FBY data has
ever existed in prod, so FBY ingestion has never actually run. Would an FBY
seller's orders reach `orders` and display correctly today?

**Status:** investigation only. No code, schema or config changed. Everything
below is derived from source; nothing was run against prod (this sandbox has no
`DATABASE_URL` and no marketplace credentials) and no FBY campaign was available
to test against.

Baseline is `main` @ `8278522`. PR #300 (`STATUS_MAP` transit states) is open and
not merged; where it changes an answer, that is called out.

---

## Verdict: **PARTIAL** — and the blocker is not where you'd expect

An FBY campaign's **orders would ingest and display correctly**. The order
fetch has no model filter, and the #299 alert gate suppresses only the *alert*,
not the row.

But an FBY seller cannot get into that state in the first place, and one thing
breaks permanently once they do:

| # | Gap | Severity | Verifiable from code? |
|---|---|---|---|
| **G1** | A seller can hold only **one** Yandex campaign. Connecting a second **wipes the first's data**. | 🔴 blocking + destructive | ✅ yes |
| **G2** | The 15-min stock refresh **fails forever** on FBY and never stops retrying. | 🟠 high (rate-limit burn) | ✅ yes |
| **G3** | Stock-writer / oversell auto-cancel have **no FBY awareness** at all. | 🟠 high (only in opt-in edit mode) | ✅ yes |
| **G4** | Onboarding has no concept of campaign *model* or of a second campaign. | 🟡 medium | ✅ yes |
| **G5** | FBY order lifecycle vs `STATUS_MAP` | 🟢 believed fine | ⚠️ needs a real FBY campaign |

**The headline:** on Yandex, FBS and FBY are normally **separate campaigns under
one business**. Daromadchi stores exactly one campaign per (user, marketplace),
so a seller running both cannot connect both — and the attempt destroys data.

---

## 1. Campaign model — one campaign per shop, and a destructive overwrite (G1)

**A shop holds ONE campaignId.** `shops.shop_id_external` is a single `text`
column (`lib/db/schema.ts:140`). The sync takes one campaign id as an argument —
`syncFromYandex(shopId, token, campaignId, …)` — called from
`app/api/cron/sync/route.ts:99` with `shop.shop_id_external`.

**Nothing iterates campaigns.** `fetchCampaigns` exists (`lib/yandex/client.ts:225`)
and returns every campaign on the token, but it is **called from nowhere** —
`grep -rn "fetchCampaigns" lib/ app/ components/` returns only its definition.
There is no campaign discovery anywhere in the product.

**Connecting a second campaign overwrites the first.** Both connect paths
resolve the existing shop by `(user_id, marketplace, is_active)` with
**campaignId absent from the predicate**:

- `app/api/shops/token/route.ts:49-50`
- `app/api/settings/save/route.ts:28-29`

So a seller who has connected their FBS campaign and then enters their FBY
campaign id does **not** get a second shop. They update the same row.

**And it deletes the first campaign's history.** `app/api/shops/token/route.ts:69-72`:

```ts
const campaignChanged = !!campaignId?.trim() && !!existing.shop_id_external
  && existing.shop_id_external !== campaignId.trim()
if (campaignChanged) {
  await clearShopData(existing.id)
```

`clearShopData` deletes `order_items`, `orders`, `products`, `sync_days`,
`ad_campaigns`, `search_phrases` for that shop (`lib/db/clear-shop-data.ts:9,14-18`).
That logic is *correct* for its intended case — a genuine account switch — but an
FBS+FBY seller adding their second campaign hits it as a data wipe, then wipes
the other way if they switch back.

**The good news: the read layer is already multi-shop.** `getShopIds`
(`lib/db/shop-context.ts:30-36`) returns an **array** of shop ids and every
consumer uses `inArray(orders.shop_id, shopIds)`. And there is **no unique
constraint** on `shops` — only `index('shops_user_id_idx')` (`schema.ts:191`),
no unique index in any migration. So the database already permits two Yandex
shops per user, and dashboards would aggregate them correctly today.

**G1 is an application-layer gap, not a schema one.** That makes it much smaller
than it first looks.

---

## 2. Does the order fetch filter to FBS? — **No** ✅

`fetchYandexOrders` (`lib/yandex/client.ts:225-240`) sends only `page`,
`pageSize` and `fromDate` to `GET /v2/campaigns/{campaignId}/orders`. No
`placementType`, no model filter, no status filter.

The endpoint is campaign-scoped, so it returns whatever that campaign has. **If
an FBY campaign were connected, its orders would come back.** Nothing in the
fetch path discriminates by fulfilment model.

---

## 3. Placement handling for FBY — ingestion and display are correct ✅

Traced `campaignPlacement` / `campaignFulfillmentType` (`lib/yandex/sync.ts:89-107`):

| | Value on FBY | Effect |
|---|---|---|
| `campaignFulfillmentType` | `'fby'` (`:102`) | written to `orders.fulfillment_type` (`:514`) and `products.fulfillment_type` |
| `campaignPlacement` | `'FBY'` (`:101`) | read **only** by the alert gate |

**The #299 exclusion does not drop the order.** This was the specific risk to
rule out, and it's clean: `isYandexSellerFulfilled('FBY')` → `false` makes
`alertableExtIds` an empty set, and that set gates **only** the `newOrders.push`
loop. The `db.insert(orders)` block is separate and unconditional
(`lib/yandex/sync.ts:595`), driven by `toInsert` alone.

So an FBY order is **inserted, updated on later ticks, and displayed** exactly
like an FBS one — it simply never produces a "нужно собрать и отправить" alert.
That is the intended behaviour: Yandex ships it, the seller doesn't pick it.

Worth noting for the future: this means an FBY seller currently gets **no
new-order notification at all**. Correct per #299's design, but "FBY sellers
should get an informational (non-fulfilment) new-order message" is a product
question that has never been asked. Flagging, not recommending.

---

## 4. Stock and status differences

### 4a. The 15-minute stock refresh fails permanently on FBY (G2) 🟠

`/offers/stocks` returns empty for FBY sellers — the codebase already knows this
(`lib/yandex/client.ts:356-358`: *"e.g. FBY-only sellers"*), and the **heavy**
sync handles it with a fallback to `POST /v2/campaigns/{id}/offers`
(`lib/yandex/sync.ts:237-241`).

**The fast path has no such fallback.** `refreshYandexStock`
(`lib/marketplace/stock-refresh.ts:164`) calls only `fetchAllYandexStocks`, then:

```ts
// stock-refresh.ts:170-173
if (stockMap.size === 0) {
  return { ok: false, seen: 0, updated: 0, error: lastError ?? 'stocks response empty' }
}
```

For an FBY shop that is the *permanent* result. And because the cron only
advances the stock clock on success (`app/api/cron/sync/route.ts:69-72` —
*"A failed refresh must stay due"*), `stock_synced_at` never moves, so the shop
is **due on every 5-minute tick, forever**: a wasted Yandex API call every tick,
a permanent error surfaced to the seller, and the 15-min refresh silently never
working. The intent of that guard is right; FBY just makes "empty" the steady
state rather than a failure.

### 4b. The FBY SUM-not-share stock rule holds ✅

`lib/db/stock-groups.ts:284-293` buckets members by `fulfillment_type`:
`'fbo' | 'fby'` → **SUM** (independent per-marketplace warehouses), everything
else → **MAX** (one physical pool listed in several places). Unknown defaults to
the FBS side, which undercounts — the safe direction. This is correct for FBY
and needs no change. Same rule mirrored at `lib/telegram-digest.ts:293`.

### 4c. Stock-writer and oversell have zero FBY awareness (G3) 🟠

`grep -rn "fby\|fbo" lib/marketplace/` returns **nothing**. So neither the
sanctioned stock writer (`stock-writer.ts`) nor the oversell auto-cancel
(`oversell.ts` → `order-cancel.ts`) filters by fulfilment model.

For an FBY shop that is wrong in principle: Yandex owns the warehouse, so
writing an `ostatok` to an FBY listing or auto-cancelling an FBY order for
"our" stock shortfall is not the seller's call to make. Two mitigations keep
this off the critical path today — both paths are gated behind per-shop opt-in
`stock_sync` mode (default `read_only`, `schema.ts:164`), and `reservingOrderCondition`
keys off raw statuses — but the model check is simply absent, and an FBY seller
who opted into edit mode would hit it.

### 4d. `STATUS_MAP` and the FBY lifecycle (G5) 🟢, unverified

`OrderStatusType` is one enum for all placement models — there is no separate
FBY status vocabulary in the Partner API spec. An FBY order moves
`PROCESSING → DELIVERY → PICKUP → DELIVERED`, all of which are covered.

Caveat: on `main` today `PICKUP` is **unmapped** and falls through `?? 'pending'`
to «Создан» — the bug PR #300 fixes. FBY orders spend a meaningful part of their
life in `DELIVERY`/`PICKUP`, so **#300 matters more for FBY than for FBS**. With
#300 merged, the mapping is believed complete for FBY.

"Believed" because this is the one item that genuinely **cannot be closed from
code**: whether an FBY campaign's orders ever surface a status our map doesn't
carry can only be confirmed against a real FBY campaign.

---

## 5. Onboarding — no path for an FBY seller (G4)

`app/dashboard/settings/SettingsForm.tsx` renders **one card per marketplace**
with a single `Campaign ID` input (`:564-575`), one API token and one Business
ID. There is:

- no way to add a **second** campaign,
- no FBS/FBY selector, and
- no mention of the fulfilment model in the hint copy — all three locales say
  only *"Числовой ID из URL … — не email"* (`lib/i18n.ts:115, 1034, 1953`).

An FBY-only seller **can** connect today: they'd paste their FBY campaign id,
`fetchCampaignInfo` would resolve `placementType: 'FBY'`, and orders would
ingest (§2, §3). It's the **FBS+FBY seller** who is blocked, and nothing in the
UI warns them that entering the second id destroys the first campaign's data.

---

## 6. Fix plan — sized into branches

Ordered by severity. Nothing here is implemented.

### Branch 1 — `fix/yandex-second-campaign-data-wipe` 🔴 do first
Narrowest fix for the destructive half of G1: make `campaignChanged` stop
meaning "wipe". Either scope the existing-shop lookup by `shop_id_external` so a
new campaign creates a **new shop row** (the DB and read layer already support
it — §1), or, if that is too large for one branch, at minimum require an
explicit confirmation before `clearShopData` runs.
**Files:** `app/api/shops/token/route.ts:49-72`, `app/api/settings/save/route.ts:28-29`.
**Risk:** medium — touches the account-switch path, which exists for a real
reason. Needs care that a genuine token re-save still doesn't wipe.
**Testable from code:** ✅ fully.

### Branch 2 — `fix/yandex-stock-refresh-fby-fallback` 🟠
Give `refreshYandexStock` the same `fetchAllYandexCampaignOffers` fallback the
heavy sync already has, so an empty `/offers/stocks` is not a permanent failure.
Decide explicitly what "genuinely empty" means so the stock clock can advance.
**Files:** `lib/marketplace/stock-refresh.ts:160-173`.
**Risk:** low, self-contained. **Testable from code:** ✅ logic; ⚠️ the real
FBY payload shape needs an FBY campaign.

### Branch 3 — `feat/multi-campaign-per-marketplace` 🔴 the real G1 fix
Let one user hold several Yandex shops (FBS + FBY), with UI to add/name/remove
them. No migration needed — `shops` already permits it and `getShopIds` already
aggregates. The work is the connect path plus `SettingsForm`.
**Risk:** medium-high — every "the shop" assumption in settings/diagnostics
needs auditing. Should follow Branch 1, not replace it.
**Testable from code:** ✅ mostly; ⚠️ end-to-end needs two real campaigns.

### Branch 4 — `fix/marketplace-writes-exclude-fby` 🟠
Exclude `fulfillment_type = 'fby'` members from the stock writer and from
oversell auto-cancel. Mirrors the #299 allowlist principle on the write side.
**Files:** `lib/marketplace/stock-allocation.ts`, `oversell.ts`, `stock-sync.ts`.
**Risk:** low-medium. Touches the audited write path, so it needs the same care
as any change under the `AGENTS.md` write rule. **Testable from code:** ✅.

### Branch 5 — `feat/onboarding-campaign-model-hint` 🟡
Surface the resolved `placementType` in Settings after a successful connect
("Campaign 149137909 — FBY"), and warn before an id change that wipes data.
Cheap, and it turns G1 from silent into visible even before Branch 3 lands.
**Files:** `SettingsForm.tsx`, `lib/i18n.ts` (×3 locales).
**Risk:** low. **Testable from code:** ✅.

### Needs a real FBY campaign (cannot be closed from code)
1. That an FBY campaign's orders actually return from `/campaigns/{id}/orders`
   with the fields we read (§2 is a code argument, not an observation).
2. The FBY order status/substatus vocabulary in practice (§4d).
3. The payload shape of `POST /v2/campaigns/{id}/offers` for FBY stock (Branch 2).
4. Whether `fetchCampaignInfo` reliably returns `placementType: 'FBY'` on a real
   FBY campaign — the whole model gate depends on that one field.

**Cheapest way to get all four:** a Yandex sandbox/test campaign in FBY mode, or
a read-only token from any FBY seller. Until then Branches 1, 4 and 5 are fully
verifiable and worth doing; Branches 2 and 3 can be built but not proven.

---

## 7. What this pass did not do

No code, schema, migration or config changed. No marketplace API was called. No
prod query was run — the two questions that would benefit from one are whether
any shop currently has a non-FBS `fulfillment_type` (expected: none, per the
brief) and whether any user has more than one active Yandex shop row (expected:
impossible today, given §1):

```sql
SELECT s.name, s.shop_id_external AS campaign_id, o.fulfillment_type, count(*)
FROM orders o JOIN shops s ON s.id = o.shop_id
WHERE o.marketplace = 'yandex_market'
GROUP BY 1, 2, 3;

SELECT user_id, marketplace, count(*) AS active_shops
FROM shops WHERE is_active
GROUP BY 1, 2 HAVING count(*) > 1;
```
