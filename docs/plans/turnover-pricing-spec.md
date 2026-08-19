# Turnover-Based Pricing — Working Spec

Last updated: 2026-08-18

**This file supersedes the original pasted pricing prompt.** That prompt is
historical: several of its values and assumptions were wrong against the real
schema and have been corrected here. Corrections are listed at the bottom with
the reason for each, so nobody reinstates them from the older text.

Replaces the flat Pro 250 000 / Pro+ 500 000 plans with a ladder derived from
each seller's own trailing-30-day turnover.

---

## 1. Tier ladder

Turnover is in so'm per 30 days, fixed (not FX-derived). "Yearly" is the
discounted **per-month** price when billed annually; the annual charge is 12× it.

| Tier | Turnover / mo | Monthly | Yearly (per-mo) |
|---|---|---|---|
| FREE | 0 – 12 000 000 | 0 | 0 |
| PRO | 12 000 000 – 50 000 000 | 150 000 | 125 000 |
| PRO_PLUS | 50 000 000 – 120 000 000 | 250 000 | 225 000 |
| BIZNES | 120 000 000 – 180 000 000 | 500 000 | 450 000 |
| ENTERPRISE | 180 000 000+ | contact — no public price | — |

Boundaries are inclusive at the bottom: exactly 12 000 000 is PRO, not FREE.

`ENTERPRISE_POPUP_THRESHOLD = 162 000 000` (90 % of the Biznes ceiling) triggers
outreach *before* the seller outgrows Biznes. It is not a band boundary.

**Bands live in `lib/billing/tiers.ts`. Prices do not, yet** — see §5.

## 2. Turnover definition

`computeTurnover30d(userId)` (`lib/db/turnover.ts`), summed across every
marketplace the account has connected. Four exclusions, all deliberate:

1. **`cancelled` and `returned` orders.** Both. A returned order earned nothing.
2. **DEMO shops**, matching `getShopIds()`.
3. **Duplicate rows**, deduped on `(shop_id, order_id_external)`.
4. **NULL revenue**, coalesced to 0.

> **Known, intended discrepancy.** `getKpis()` excludes only `cancelled`, so the
> dashboard's revenue figure reads HIGHER than billing turnover. The pricing UI
> must say this out loud, or the first seller near a boundary will ask why.

## 3. Feature gating (Model B — trial, then limited)

| Feature | FREE | PRO | PRO_PLUS | BIZNES | ENTERPRISE |
|---|---|---|---|---|---|
| dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| products | ✓ | ✓ | ✓ | ✓ | ✓ |
| orders + telegram alerts | ✓ | ✓ | ✓ | ✓ | ✓ |
| both marketplaces | ✓ | ✓ | ✓ | ✓ | ✓ |
| analytics | trial | ✓ | ✓ | ✓ | ✓ |
| stock sync (Sklad) | trial | ✓ | ✓ | ✓ | ✓ |
| finances / payouts | trial | ✓ | ✓ | ✓ | ✓ |
| unit-economics | trial | ✓ | ✓ | ✓ | ✓ |

"trial" = free for the account's first **14 days** (2 weeks), then gated. After
trial a free account keeps dashboard + products + orders/alerts + both
marketplaces.

The length is `TRIAL_DAYS` in `lib/billing/features.ts` and every user-facing
string derives from it. Do not hardcode the number in copy — that is how the
site advertised a 3-day trial long after the code had changed.

One data structure, one `hasFeature(account, feature)` helper. No scattered
inline plan checks — and note there are already **three** copies of
effective-plan logic to consolidate rather than add a fourth:
`lib/api/auth.ts:32`, `app/api/cron/sync/route.ts:31`,
`app/api/diagnostics/state/route.ts:16`.

### Trial expiry is evaluated LIVE, not by cron

`expire-plans` runs `15 3 * * *` — once daily. Evaluating trial end there would
give a trial ending at 09:00 another ~18 hours of full access. The cron
**persists the derived tier**; `hasFeature()` evaluates trial expiry **at read
time**, which is what `getEffectivePlan` already does with `trial_ends_at`.

### Grandfathering

Accounts on the old Pro/Pro+ keep their price and full access permanently.
`is_grandfathered` is checked FIRST in `hasFeature()`, before any turnover logic.
Never recomputed, never downgraded.

## 4. Stock-sync at trial end

Gate on **`shops.api_mode`**, which is per-SHOP and already the write guard —
NOT on "API key type", which is not stored and cannot be detected (see §7).

| Shop `api_mode` | At trial end on a FREE account |
|---|---|
| `stock_sync` | Stop auto write-back to both marketplaces; stop cross-store stock-update Telegram alerts. Page display may remain. |
| `read_only` | Never had write-back, so also gate the Stocks page (upgrade prompt). |

A user can hold both kinds at once, so gate the page only when **every** active
shop is `read_only`.

**Two precision points:**

- `notif_stock_update_telegram` (cross-store write-back events) is a DIFFERENT
  flag from `notif_low_stock` (low-stock warnings). Free keeps low-stock alerts.
  Gating both silently removes something Free is supposed to have.
- Stock-update alerts are emitted by the write-back pipeline itself, which only
  runs for `stock_sync` shops. For `read_only` shops they never fire today, so
  "stop the alerts" is already a no-op there.

### The Stocks page is gated, not frozen

Show a clear locked/upgrade state. Do **not** serve a frozen snapshot: stock
numbers that look live but are stale could have a seller restock against a wrong
figure. An honest lock beats a trap.

### Hard constraint

Write-back is the one sanctioned exception in `AGENTS.md`, guarded at
`lib/marketplace/stock-writer.ts:218` (`api_mode !== 'stock_sync'` → skip). Plan
gating is an **additional** condition layered on top. It must never replace or
"simplify" that guard, and must never enable a write the guard would deny.

## 5. Billing rules

### Renewal charges the agreed price

`subscriptions.agreed_amount_tiyin` records what the seller authorised. The
renewal cron charges **that**, never the live `PLAN_PRICES_TIYIN`. NULL ⇒ skip
the renewal and alert; never guess. Changing a plan's configured price must
never move an existing subscriber.

### Price increases require notice

To raise an existing subscriber's price: set `pending_amount_tiyin` +
`pending_effective_date` (their next renewal). Before that renewal charges, send
an in-app popup and a Telegram alert naming the new amount and the date. The new
price applies only from the cycle after notice.

### Cancellation

A "Cancel plan" button in billing settings: stop renewal, keep access until
`current_period_end`, then drop to FREE. Record `cancelled_at` + `access_until`
and show "active until {date}, then Free."

A seller notified of a price increase must be able to cancel so that it takes
effect **before** `pending_effective_date` — they are never charged the new
amount against their will.

### Policy pages

Prices may change with advance notice; sellers are notified in-app and via
Telegram before any new amount is charged; a new price applies only from the next
cycle; sellers may cancel before it takes effect.

Account lifecycle also needs a clause (inactive free accounts may be frozen and,
after warning, deleted) — required for the Personalization Agency registration
(№322191225): the deletion basis must be on record, not only in code.

## 6. Branch sequence

One change per branch, separate PRs, in order. Do not bundle.

| # | Branch | Status |
|---|---|---|
| 1 | `feat/turnover-tier-compute` | **merged** (#219) |
| 1a | `fix/renewal-agreed-price` | **merged** (#220) |
| 2a | the `hasFeature` rule itself | **merged** (#222) |
| 2b | derived tier persisted as a recommendation | **merged** (#223) |
| 2c | `feat/plan-gating` — apply the rule | **this branch** |
| 3 | `feat/pricing-page-ui` | **merged** (#224, #226, #227, #229, #230, #231) |
| 4 | `feat/free-to-paid-nudge` | |
| 5 | `feat/enterprise-outgrowth-popup` | |
| 6 | `feat/account-lifecycle-freeze-delete` | |
| 7 | `feat/plan-cancellation` | greenfield — see §7 |
| 8 | `feat/price-change-notice` | depends on 1a + 7 |
| 9 | `test/recurring-charge-harness` | must follow 1a |

Branch 2 was split in delivery: the rule (2a) and the recommendation it reads
alongside (2b) shipped before anything was gated, so the gate could be turned on
in one reviewable change with the rule already proven.

Cron is already scheduled on the VPS (`/var/www/daromadchi/cron-runner.sh`, not
in git). Hook trial/freeze work into the existing `expire-plans` job and
recurring-charge work into `billing-renew`. Do not add a scheduler.

**Out of scope:** real auto-charging (blocked on ATMOS `unknown_account`),
editing or backdating any real ATMOS transaction, full invoice automation,
per-seat add-ons.

## 7. Corrections to the original prompt

Each of these was wrong in the earlier text. Listed so they are not reinstated.

| Original | Corrected | Why |
|---|---|---|
| Pro band 12–90 mln | **12–50 mln**, Pro+ 50–120 | Superseded twice during design. |
| Biznes 450 000 monthly, yearly TBD | **500 000 monthly / 450 000 yearly** | Yearly was later set. |
| Unique key `(marketplace, external order id)` | **`(shop_id, order_id_external)`** | The shop already implies the marketplace, and the original key collides across two different sellers on the same marketplace, rejecting the second one's genuine order. It also would not back the lookup sync performs. |
| Prices in the new tier module | **Bands only; prices stay in `PLAN_PRICES_TIYIN`** | Two modules owning money is a trap, and editing the charged constant would reprice live subscriptions before grandfathering exists. |
| Trial expiry evaluated on the cron | **Evaluated live in `hasFeature()`** | `expire-plans` is daily; a trial ending at 09:00 would get ~18 free extra hours. |
| "Detect API key type per account" | **Gate on `shops.api_mode`** | Key capability is not stored and cannot be detected: `validateMarketplaceToken` treats a Yandex 403 ("valid token, restricted permissions") as valid. `api_mode` is per-shop and is already the write guard. |
| Branch 7 cancellation "already scaffolded — verify it" | **Greenfield** | No cancel endpoint, no cancel UI, no `cancelled_at`/`access_until`. What exists is `/api/billing/autorenew`, a boolean toggle across all of a user's subscriptions. |
| Run the turnover distribution query first | **Skipped** | No user base yet; a unique index makes duplicates impossible instead of something to clean up. Query retained at `scripts/turnover-distribution.sql`. |

## 8. Open decisions

- **The 50 000 so'm test subscription.** Migration 072 locks its agreed price at
  50 000 forever. Correct on consent grounds; moving it to the real price is a
  deliberate act that needs notice, i.e. the price-change branch.
- ~~**Store limits.**~~ **Resolved in 2c: dropped.** `PLAN_SHOP_LIMITS` enforced
  nothing — no caller read it — while `/pricing` advertised "Unlimited
  do'konlar", and capping free at one shop would have contradicted
  `marketplaces` being FREE_FOREVER (two marketplaces need two shops). Store
  count is not a gated capability; what a seller may USE is
  `lib/billing/features.ts`. The Free card's bullets were rewritten to the
  free-forever set at the same time, since "100 products" and "30-day history"
  were unenforced in exactly the same way.
- ~~**In-flight trials.**~~ **Resolved: not applicable.** There are no users, so
  nobody is mid-trial and the new gating applies cleanly. No grandfathering of
  trial scope is needed.

- **The `plan_type` enum stops at `biznes`.** `hasFeature()` answers correctly
  for `'enterprise'`, but no row can hold that value, so an enterprise seller
  cannot be recorded as one. Needs a migration when Branch 5 lands.
- **`cron-runner.sh` is not in version control.** If the VPS dies, the schedule
  dies with it.
