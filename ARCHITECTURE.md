# Daromadchi — Application Architecture

Multi-marketplace seller dashboard for **Uzum Market and Yandex Market**. The app
is approaching its first full release — billing, payouts, and finances are wired
end-to-end and the remaining work is accuracy polish (see the "Known gaps" notes).

> Wildberries support was removed entirely (code + the `marketplace_type` enum);
> the platform now covers Uzum Market and Yandex Market only.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.4 (App Router, React 19, Turbopack) |
| Database | PostgreSQL 17 (self-hosted on the same Hetzner VPS) |
| ORM | Drizzle ORM (~39 tables) |
| Auth | NextAuth v5 — Credentials (email + password, bcrypt) + optional Google OAuth; JWT sessions, cookies scoped to `.daromadchi.uz` |
| Payments | **ATMOS** aggregator — direct card-binding (card→OTP) checkout, integrated in-app |
| Styling | Tailwind CSS v4 + CSS custom properties (theme tokens) |
| Analytics | Google Analytics 4 via `@next/third-parties`, consent-gated and production-only |
| Hosting | Hetzner VPS (Finland / Helsinki), nginx reverse proxy → Node.js (pm2) |
| Extension | Chrome Manifest V3 |

## Directory Structure

```
app/
  dashboard/           # Authenticated dashboard pages
    analytics/         # Margin analysis, product profitability (trial-gated)
    products/          # Product list with cost price editing
    stocks/            # Warehouse stock overview (trial-gated unless a shop is in stock-sync)
    orders/            # Order history
    pnl/               # Profit & Loss (delivered-only realized revenue)
    payouts/           # «Заработок» — marketplace settlements / earnings by period
    unit-economics/    # Per-product unit economics (trial-gated)
    billing/           # Subscription plan, ATMOS checkout modal & payment history
    settings/          # Shop tokens, preferences
    sync/              # Manual sync trigger
    account/           # Account management, incl. "Request account deletion"
    ...                # alerts, notifications, calculator, referral, team, etc.
  api/
    cron/sync/             # Scheduled sync: plan-gated heavy pass + 15-min stock refresh
    cron/stock-sync/       # Scheduled cross-marketplace stock reconcile / write-back
    cron/billing-renew/    # Auto-renew charges (flag-gated, DRY-RUN by default)
    cron/telegram-digest/  # Telegram summary
    uzum/sync/             # Manual Uzum sync
    yandex/sync/           # Manual Yandex sync
    billing/atmos/         # ATMOS direct checkout: bind-init, bind-confirm, callback (+ deprecated create)
    billing/cancel/        # Cancel / resume subscription
    billing/autorenew/     # Toggle auto-renew
    billing/expire-plans/  # Cron: downgrade lapsed paid plans to free (+ piggyback sweeps)
    account/request-deletion/  # User-facing account-deletion request (notifies operator)
    auth/delete-account/       # Admin-only hard delete by email
    products/update/       # Cost price updates
    extension/             # Extension API endpoints (Bearer token auth)
    telegram/              # Telegram bot integration
    ...
  login/               # Auth pages
  pricing/             # Public pricing page (i18n uz/ru/en, monthly/yearly toggle)
  privacy/ terms/ cookies/ compliance/   # Public legal pages (uz/ru/en)

lib/
  db/                  # Drizzle schema, queries, cached data functions
    schema.ts          # Database schema (~39 tables)
    products.ts        # Product queries (unstable_cache, tags: ['product-data'])
    orders.ts          # Order queries (unstable_cache, tags: ['order-data'])
    kpis.ts revenue.ts pnl.ts payouts.ts unit-economics.ts   # Aggregations
    real-financials.ts # Real per-bucket settlement financials (commission/delivery/net)
    payout-status.ts   # Pure payout-status derivation from real marketplace signals
    turnover.ts        # Trailing-30-day net turnover (feeds the derived tier)
    billing.ts         # Plan + payment-history reads
  uzum/                # Uzum Market API: sync.ts, client.ts, settlements-sync.ts, stock-reading.ts
  yandex/              # Yandex Market API: sync.ts, client.ts, settlements-sync.ts, netting-report.ts
  marketplace/
    stock-writer.ts    # The single audited stock-quantity writer (opt-in edit mode)
    order-cancel.ts    # The single audited oversell order-cancel path
    stock-refresh.ts   # Cheap 15-min stock-only refresh (decoupled from the heavy pass)
  marketplace-readonly-guard.ts   # Method/URL allowlist enforcing read-only-by-default
  billing/
    plans.ts           # Money source of truth: PLAN_PRICES_TIYIN (pro/pro_plus/biznes)
    tiers.ts tier-pricing.ts turnover  # Turnover-ladder tier derivation (advisory)
    entitlement.ts features.ts nav-gating.ts   # What the seller PAID for → feature gating
    atmos.ts atmos-verify.ts recurring.ts       # ATMOS API client, signature verify, token charge
    activate.ts cancel.ts renew.ts              # Subscription lifecycle
    price-notice.ts nudge.ts lifecycle.ts       # Staged price changes, nudges, inactivity ladder
  auth/
    session.ts         # getCurrentUser(), getUserFromBearerToken()
    config.ts          # NextAuth config (Credentials + optional Google; cross-host cookie domain)
  api/auth.ts          # Extension auth (getExtensionUser), plan logic
  crypto.ts            # API key + ATMOS card-token encryption/decryption (AES-256-CBC)
  telegram.ts          # Telegram message sending
  cookie-consent.ts    # GA4 consent gate

components/dashboard/  # Shared dashboard components
extension/             # Chrome extension (see Extension section)
proxy.ts               # Middleware — apex→www redirect, CORS, rate limits, security headers, auth gate
```

## Data Flow

### Marketplace Sync (decoupled cadence)

The single cron `/api/cron/sync` runs every 5 minutes, but the work inside it is
split so the expensive part stays throttled while the parts sellers actually
notice run often:

```
VPS crontab (*/5 * * * *) ──► /api/cron/sync  (CRON_SECRET)
     │
     ├─ Heavy pass  — full products + orders + settlements + ads sync.
     │                PLAN-GATED / throttled: ~2h on paid, ~6h on free.
     │                Advances shops.last_synced_at. Settlements (extra API +
     │                async Yandex netting reports) run ONLY on a heavy tick.
     │
     └─ Stock-only refresh — cheap live-quantity re-read, every 15 min per shop
                        (STOCK_REFRESH_MS, keyed off its own shops.stock_synced_at
                        clock), skipped on a heavy tick. lib/marketplace/stock-refresh.ts.
     ▼
  PostgreSQL (products, orders, stocks, settlement tables)
     ▼
  unstable_cache (revalidate: 30s, tags: ['product-data', 'order-data'])
     ▼
  Dashboard pages read cached data
```

**Why the split (migration 080).** `last_synced_at` means "the heavy pass ran";
it can't also mean "stock is current" without one of them lying. `stock_synced_at`
is the stock clock and nothing else reads/writes it. Before this, a seller who
restocked saw a stale number for hours and concluded the app doesn't update.

**Stock-refresh rules.** It reads Uzum's **card** endpoint (carries
`quantityActive + quantityFbs`), NOT `/v3/fbs/sku/stocks` (FBS-only — would
overwrite a correct combined FBO+FBS figure with an FBS-only one). And a SKU
**absent** from the response is UNKNOWN, never zero (the "RUN_OUT" fix — treating
absence as sold-out would zero a whole catalogue on a paging hiccup).

**Cache invalidation.** Mutation endpoints call `revalidateTag(tag, { expire: 0 })`.
`{ expire: 0 }` is critical — `'max'` serves stale data on the first request.

### Manual Sync

Users can trigger sync from `/dashboard/sync` → `/api/{uzum,yandex}/sync`,
authenticated via NextAuth session.

### Marketplace API Rules (IMMUTABLE)

**The app is READ-ONLY by default and MUST NEVER send PUT, PATCH, or DELETE requests
to any external marketplace API.** POST is only allowed when the marketplace API
requires POST for a READ operation (e.g. Yandex offer-mappings/stocks/stats return
405 on GET). The single sanctioned write exception is the opt-in, per-shop
**Stock-sync (edit)** mode, which — after the seller consents — updates ONLY the
stock quantity (ostatok) through one audited writer (`lib/marketplace/stock-writer.ts`),
plus a separately-allowlisted oversell order-cancel path
(`lib/marketplace/order-cancel.ts`). Everything is enforced by
`lib/marketplace-readonly-guard.ts` and audited in `stock_write_log` /
`order_cancel_log`. See `AGENTS.md` for the owner-set invariant.

## Payments & Billing

### ATMOS integration (the checkout)

Billing runs on the **ATMOS** aggregator via a **direct card-binding** flow
integrated into the app's own dashboard — not a hosted redirect.

- **Card entry is in-app but transit-only.** The upgrade modal
  (`app/dashboard/billing/BillingClient.tsx`) walks `choose → confirm → card → otp
  → success`. The PAN + expiry are typed into app inputs and POSTed to our own
  routes; the PAN **passes through the server transit-only — never stored, never
  logged**. What we persist is a reusable ATMOS **card token, encrypted**
  (`lib/crypto`), plus display-only `card_last4 / expiry / holder`.
- **`POST /api/billing/atmos/bind-init`** (step 1): validates plan + interval,
  derives the amount **server-side** (`planAmountTiyin`, never trusts the client),
  inserts `pending` `subscriptions` + `payments` rows *before* any ATMOS call (so
  the callback can resolve the account), then calls ATMOS `bind-card/init` → an
  **SMS OTP** is sent to the cardholder. Returns `{ paymentId, subscriptionId, bindTxnId }`.
- **`POST /api/billing/atmos/bind-confirm`** (step 2): calls ATMOS `bind-card/confirm`
  with the OTP → reusable card token; stores it encrypted, then charges the first
  period with `chargeBoundCard(...)` and activates via `applyAtmosPaymentSuccess`.
  Idempotent if already `success`; on charge failure returns `cardBound:true` so the
  UI retries the charge without re-binding.
- **`chargeBoundCard`** (`lib/billing/recurring.ts`): the token charge is three
  ATMOS calls in one place — `pay/create → pay/pre-apply → pay/apply`. For a token
  charge the apply OTP is the literal `111111` (no SMS).
- **`POST /api/billing/atmos/callback`** (public, server-to-server): ATMOS finalizes
  a charge only when we reply `200 {"status":1,...}`. Steps: log raw body → optional
  source-IP allowlist → verify `sign == md5(store_id + transaction_id + account +
  amount + api_key)` (constant-time, `atmos-verify.ts`) → look up payment by
  `account` (idempotent re-ack if already success) → **advisory, non-blocking**
  status cross-check → `applyAtmosPaymentSuccess({source:'callback'})`.
- **`POST /api/billing/atmos/create`** is the **deprecated** hosted-invoice path
  (`createInvoice` returns `-999999` for our store — broken on ATMOS's side); kept
  for reference, not the live flow.
- **Amount is always integer tiyin** (1 so'm = 100 tiyin), derived server-side from
  `PLAN_PRICES_TIYIN`, never taken from the client.

### Card types accepted

Today the checkout accepts **Uzbek domestic cards — Uzcard / Humo**. **Visa /
Mastercard (including Uzbekistan-issued cards) are NOT yet accepted — that support
is in progress.** Note: there is **no card-type gate in the app code** (the only
PAN validation is `^\d{16,19}$`); the accepted-scheme limit is enforced on the
**ATMOS account side**, not in this repo.

### Plan / turnover-ladder model

- **Sellable plans** (`lib/billing/plans.ts` `PlanKey`): `pro`, `pro_plus`, `biznes`.
  **Enterprise is quote-only** (no single published price → checkout can't bill it).
- **Prices** — `PLAN_PRICES_TIYIN` is the one money source of truth (fixed so'm in tiyin):
  | Plan | Monthly | Yearly (per-month equiv, billed once × 12) |
  |---|---|---|
  | Pro | 150 000 so'm | 125 000 so'm/mo |
  | Pro+ | 250 000 so'm | 225 000 so'm/mo |
  | Biznes | 500 000 so'm | 450 000 so'm/mo |
  Annual total = `annualPerMonth × 12`, charged once. The "−N%" discount badge is
  **derived** from the two real prices so display can't disagree with the charge.
  USD figures are display-only, never charged.
- **Entitlement vs. tier (important).** Feature access gates on `users.plan` — what
  the seller **paid** for. `users.derived_tier` is a turnover-based **recommendation
  only** (from `lib/db/turnover.ts` trailing-30-day net turnover via `tiers.ts`
  bands) and is **never** read by feature gating — only by nudges. `users.plan` is
  written only by settlement (`activate.ts`) and expiry (`expire-plans`).
- **Feature gating** (`lib/billing/features.ts` / `entitlement.ts`):
  - `FREE_FOREVER`: `dashboard, products, orders, marketplaces` — kept forever.
  - Trial-then-gated: `analytics, stock_sync, finances, unit_economics`.
  - **14-day trial** (`TRIAL_DAYS`); an in-trial free account is treated as `pro`.
    Grandfathered accounts (old flat-price) always pass. `nav-gating.ts` decides which
    sidebar entries show a lock (advisory; pages re-check server-side).

### Subscription lifecycle

- **Activation** — `activate.ts` `applyAtmosPaymentSuccess` is the ONE place a
  payment becomes SUCCESS and a plan activates. **Idempotent / at-most-once** via a
  single conditional `UPDATE` gated on non-final `atmos_status` inside a
  transaction. Extends from the later of now / current expiry (renewals add time),
  and writes `users.plan` + `plan_expires_at` for any valid plan key.
- **Auto-renew** — `renew.ts` charges the **`agreed_amount_tiyin`** (the price the
  subscriber agreed to, never live config) for subs due within 24h. The cron
  `/api/cron/billing-renew` is **flag-gated** (`BILLING_AUTORENEW_ENABLED`) and
  **DRY-RUN by default** — real auto-charging is still blocked on an ATMOS
  `unknown_account` issue.
- **Cancellation** — `cancel.ts`: "stop the next charge, keep what was paid for."
  Sets `status='cancelled'`, `autorenew=false`, `cancelled_at`, `access_until`
  (= period end); it **never touches `users.plan`** — access runs to period end,
  then the daily job lapses it to free. `resumePlan` undoes it while `access_until`
  is still in the future. Route: `/api/billing/cancel` (`action: cancel|resume`).
- **Lapse / expire** — `/api/billing/expire-plans` (daily cron) downgrades
  `users.plan → free` where `plan_expires_at < now`. It piggybacks four best-effort
  sweeps: recompute derived tiers, dispatch due price notices, dispatch tier nudges,
  and the account-lifecycle sweep. A failed renewal → `past_due`; past a 3-day grace
  → free, but the card token is kept for recovery.
- **Price-change notice** — `price-notice.ts`: nobody is charged an amount they
  weren't told about. Gates: STAGED (`pending_amount_tiyin` + `pending_effective_date`)
  → NOTIFIED (Telegram/email, ≥14 days ahead) → CHARGED (only on the first renewal
  on/after the effective date, and only after a successful charge).
- **Nudges** — `nudge.ts`: one-shot suggestions (`trial_ending`, `trial_ended`,
  `outgrew_free`, `enterprise_outreach`). Recommendations only — never change
  plan/price; throttled per `(user_id, kind)` in `user_notices`.
- **Account lifecycle** — `lifecycle.ts`: 365 days inactive → warn, +30 → freeze
  (reversible, destroys nothing), +90 → deletion-eligible. Deletion is behind
  `ACCOUNT_LIFECYCLE_DELETE_ENABLED` and only for never-paid free accounts (payment
  history / live subscription / grandfathered accounts are protected).

## Payouts — «Заработок»

The payouts page is surfaced as **«Заработок»** (RU) / **Daromad** (UZ) /
**Earnings** (EN) and shows real settlement money by period (gross · commission ·
delivery · net), with a weekly/period view.

**Status is driven by REAL marketplace signals, never the calendar** (see
`lib/db/payout-status.ts`):

- **Yandex — payment-order (п/п) based.** The united-netting report's «Статус»
  column carries the authoritative signal: a past-tense send wording
  («Переведён…» / «Отправлен») **plus a payment-order number** means the money
  reached the seller's bank → `paid`. Otherwise the bucket is pending/available.
  (Matching on the word stem covers Yandex's gender/number inflections; missing the
  «Отправлен» wording once put a genuinely-paid order under "Ожидает".)
- **Uzum — no completed-withdrawal signal, so never `paid`.** Settlement data comes
  from `GET /v1/finance/orders` (the same "Финансы → Продажи" view the seller sees),
  with authoritative commission / delivery / profit. But Uzum exposes **no
  payout-history / completed-withdrawal API to the seller token** (it returns 403
  RBAC), so "paid" is unprovable and is **never emitted** — a Uzum bucket tops out
  at `available_to_withdraw` (money earned, withdrawal state unknown) or `pending`.

## Money — one definition of profit

`lib/money/` is the single place profit is defined. Everything that shows a
profit figure — dashboard KPIs, the extension `/stats` endpoint, the daily
Telegram summary — loads through it.

**`orderEconomics` is `revenue − fees − COGS`.** There is no second formula.

**`Known<T>` makes an unknown unwritable.** It is a discriminated union:

```ts
type Known<T> = { known: true; value: T } | { known: false; reason: UnknownReason }
```

An absent fee or cost cannot be silently read as `0`; the compiler forces the
caller to say what happens instead. This exists because every profit bug this
project shipped had the same shape — `coalesce(marketplace_fee, 0)` claiming
*Yandex charged nothing*, `coalesce(cost_price, 0)` claiming *these goods were
free* — producing a number plausible enough to trust.

**The two unknowns get different policies, deliberately:**

| unknown | behaviour | why |
|---|---|---|
| `fee_not_reported` | order **excluded**, marketplace named under the total | the seller can only wait for the netting report |
| `cost_not_set` | order **counted**, total **flagged** | the seller can fix it in a minute; excluding it would show someone who has never entered a cost a permanent zero |

**Order scope is delivered-only** (`lib/money/load-order-economics.ts`), and COGS
is `NULL` when *any* item in the set lacks a cost. A total missing one product's
cost is not a smaller cost — it is an unknown one.

**Surfaces that carry their own partial-COGS marker** rather than routing through
`sumEconomics` (they aggregate per bucket, not per order): `lib/db/pnl.ts`
(`cogsPending`) and `lib/db/payouts.ts` (`cogsPartial`). Both sum only costed
items and flag the shortfall instead of defaulting a missing cost to zero.

**Known gap:** `lib/uzum/sync.ts` can *derive* a fee from the shop balance and
write it into `orders.marketplace_fee`. Nothing distinguishes a derived fee from
a reported one, so the money module treats it as known. See `AUDIT.md`.

## Profit & Loss (P&L)

Daily/monthly P&L with a full expense breakdown (`lib/db/pnl.ts`). Where a
marketplace doesn't report fees per order, the expense lines are ESTIMATED from the
seller's Unit-Economics percentages; where real settlement data exists for a bucket
it **replaces** the estimate (same precedence as Payouts). COGS = Σ(unit cost ×
units sold).

**Revenue recognition — delivered-only (accrual basis).** Only orders with
`status='delivered'` count toward **Общая выручка / Чистая прибыль**. In-transit
orders (`pending` / `confirmed`) are **not yet earned** and are shown as a separate
**«В процессе»** figure, explicitly excluded from profit; `cancelled` / `returned`
stay excluded. COGS is likewise recognised only for delivered orders. This fixes a
bug where an undelivered order (no settlement → zero fees) was booked as near-pure
profit, overstating both revenue and net until it delivered — or forever if it
cancelled. (Shipped in #277. Both marketplaces normalize `DELIVERED` / `COMPLETED`
/ PVZ-pickup → `delivered`.) Payment/п/п confirmation is intentionally **not** used
here — cash-received is the Payouts page's concern; the P&L recognises delivered
revenue on the accrual basis.

**Yandex fees are settlement-only** — never estimated from a percentage. A Yandex
sale whose netting hasn't landed shows its fee as "pending", not a fabricated zero
or estimate.

**Yandex deduction breakdown** is classified by the **service name**
(`product_name`, the «…услуги (к удержанию)» column) via one shared helper,
`classifyYandexDebit` (`lib/db/real-financials.ts`): `"Доставка покупателю"` →
delivery, `"Поручение на продажу"` → commission, everything else (penalties,
transfer/acquiring, storage, ads) → a distinct **«Прочие»** line. The same
classifier backs the P&L, Payouts «Заработок», and Unit-Economics per-SKU rates,
so all three reconcile with the seller's netting report to the som. (Keying off
`order_type` was wrong — it's always "Продажа физлицу".)

## Account Deletion & Data Retention

- **User-facing request** — `/api/account/request-deletion`: a logged-in user
  requests deletion; the app notifies the operator (email to `privacy@daromadchi.uz`
  + Telegram to admin) and confirms receipt. It does **not** delete anything itself.
- **Admin action** — `/api/auth/delete-account` (guarded by `x-admin-secret`):
  hard-deletes users by email. Personal data is removed via the `users` FK cascade.
- **Financial/tax records survive deletion.** `payments.user_id` is
  `ON DELETE SET NULL` (migration 055), so the payer link is severed but the row is
  retained; `payments.payer_email` (migration 056) preserves who paid for tax.
- **No automatic retention purge** — a 30-day post-cancellation auto-purge was built
  then removed. The separate **account-lifecycle** ladder (365d→warn→freeze→delete,
  see Billing) only targets never-paid free accounts and is deletion-flag-gated.

## Authentication

### Web App Auth

- NextAuth v5 with a **Credentials** provider (email/password, bcrypt) and an
  **optional Google OAuth** provider (rendered only when Google env vars exist).
- JWT sessions stored as HTTP-only cookies (no DB session adapter).
- **Cross-host cookie scope.** The site serves both the apex `daromadchi.uz` and
  `www.daromadchi.uz` (proxy.ts 301s apex→www for pages but not for `/api/*`).
  The session + callback cookies are therefore scoped to the parent domain
  **`.daromadchi.uz`** (production; overridable via `AUTH_COOKIE_DOMAIN`) so one
  login is valid on both hosts. Without this, a login whose POST landed on the apex
  wrote a host-only cookie the `www` pages never received — leaving paid users
  "unrecognized" (empty dashboard, free-tier gating), most visibly on mobile. The
  CSRF cookie keeps its default `__Host-` prefix (host-only; `__Host-` forbids a
  Domain) — fine, it's validated on the same host as the POST.
- `getCurrentUser()` reads the session → looks up the user by email.
  `getUserFromBearerToken()` decodes the NextAuth JWT for API calls.

**Signup consent gate (ZRU-547).** Account creation requires explicit, opt-in
consent to the Privacy Policy, Terms and Cookie Policy:
- The signup form has a required, unchecked-by-default checkbox; it disables both
  "Create account" and "Continue with Google" until ticked (uz/ru/en).
- **Server-enforced:** `/api/auth/signup` rejects with 400 unless `consent === true`.
  For Google, the new-user branch of the `signIn` callback requires a short-lived
  first-party `signup_consent` cookie (set before the OAuth redirect); without it no
  account is created and the user is bounced to `/login?consent=required`. Existing
  users are unaffected. Consent is recorded as `users.consented_at` (migration 058).

### Extension Auth (Token-based)

The extension uses a separate token-based auth system (not NextAuth JWTs):

1. User installs the extension and visits `daromadchi.uz` / `www.daromadchi.uz`.
2. `content-daromadchi.js` calls `GET /api/extension/me` with `credentials: 'include'`.
3. The server generates an opaque token, stores it in `users.extension_token`, and
   hands it to the content script → background service worker → `chrome.storage.local`.
4. Subsequent extension API calls send `Authorization: Bearer <token>`, validated by
   `getExtensionUser()` (`WHERE extension_token = ?`).

**Note:** `extension_token` is intentionally NOT in the Drizzle schema; it is read
via raw SQL in `lib/api/auth.ts`. This is a deliberate convention, and the flow is
live in production.

## Chrome Extension

Chrome Manifest V3 extension with a service worker (`background.js`).

| Content script | Runs on | Purpose |
|---|---|---|
| `content-daromadchi.js` | `daromadchi.uz`, `www.daromadchi.uz` | Auth sync — fetch token from app, send to background |
| `content.js` | `uzum.uz`, `*.uzum.uz` | Injects analytics overlay on Uzum product pages |
| `content-yandex.js` | `partner.market.yandex.ru`, `market.yandex.*` | Injects analytics on Yandex Market |

> `extension/content-wb.js` still ships in the bundle but is **dead** — Wildberries
> was removed. It should be dropped in a dedicated extension cleanup/republish.

**Extension API endpoints** (all `getExtensionUser()` Bearer auth): `/api/extension/`
`me` (handshake), `stats`, `products`, `product`, `send-alerts`,
`send-daily-summary`, `telegram-link`, `telegram-status`.
**Storage keys** (`chrome.storage.local`): `daromadchi_token`, `daromadchi_connected`,
`daromadchi_email`, `tgStatus`, `cachedStats`, `cacheTime`.

## Analytics & Privacy

- **Google Analytics 4** loads via `@next/third-parties` only when **every** gate
  passes: production, a `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set, **and** the visitor
  accepted analytics cookies. Until consent, `gtag.js` is never fetched.
- **No PII** (emails, user IDs, shop names) is ever sent to GA.
- Consent is managed in `lib/cookie-consent.ts`; the public `/cookies` page lets
  users re-open the banner. Detail lives on `/privacy` and `/cookies`.

## Theming

Two themes (light / dark), controlled by `data-theme` on `<html>`.

**Do NOT use the Tailwind `dark:` prefix. Use CSS variables:** `var(--bg-base)`,
`var(--bg-card)`, `var(--bg-card2)`, `var(--text-base)`, `var(--text-muted)`,
`var(--text-dim)`, `var(--border)`, `var(--border2)`, `var(--c1)` (brand primary,
blue), `var(--c2)`. Light theme has a blue canvas (`#83c0f7`); dark is Revolut-style
black (`#161616`).

## Telegram Integration

- Bot sends order notifications, stock alerts, and daily/weekly summaries.
- Connected via `/api/telegram/webhook`; the user links their account from
  `/dashboard/settings` (one-time token). Controlled by user preferences
  (`notif_new_orders`, etc.).

## Scheduled Jobs

Installed into the VPS system crontab by `deploy.yml` → `cron-runner.sh`, each
protected by `CRON_SECRET`:

| Job | Schedule (server, UTC) | Endpoint | Notes |
|---|---|---|---|
| Marketplace sync | Every 5 min (`*/5 * * * *`) | `/api/cron/sync` | Plan-gated heavy pass + 15-min stock refresh + settlements on heavy ticks |
| Stock-sync (write-back) | Every 5 min (`*/5 * * * *`) | `/api/cron/stock-sync` | Cross-marketplace reconcile + opt-in write-back |
| Telegram digest | Hourly at :05 (`5 * * * *`) | `/api/cron/telegram-digest` | |
| Expire plans | Daily 03:15 (`15 3 * * *`) | `/api/billing/expire-plans` | + tier recompute, price notices, nudges, lifecycle sweep |
| Auto-renew | (flag-gated) | `/api/cron/billing-renew` | DRY-RUN unless `BILLING_AUTORENEW_ENABLED=1` |

> There is **no** retention-purge cron — that feature was removed.

## Data Backups

Nightly Postgres backups via `.github/workflows/db-backup.yml` (`0 3 * * *` = 03:00
UTC + manual `workflow_dispatch`). GitHub Actions SSHes into the VPS and runs
`pg_dump` **on the VPS itself** (Postgres is bound to 127.0.0.1), keeping the **14
newest rotated dumps** at `/var/backups/daromadchi/`. **The dump never leaves the
VPS** — not copied off-host or uploaded as a GitHub artifact — so the full DB stays
on our own infrastructure and GitHub is not a data processor.

## Database & Migrations

- Schema is defined in `lib/db/schema.ts` (Drizzle, **~39 tables** — `users`,
  `shops`, `orders`, `order_items`, `products`, `payments`, `subscriptions`,
  `unit_economics_items`, `warehouses`, `user_notices`, `stock_ledger`,
  settlement tables, `stock_write_log`, `order_cancel_log`, and the stock/oversell
  dedup tables, etc.).
- SQL migrations live in `migrations/migrations/NNN_*.sql` and are applied on deploy
  by `scripts/apply-sql-migrations.mjs`.
- **A migration file only runs if it is registered in the `MIGRATIONS` array** in
  `scripts/apply-sql-migrations.mjs`. Unregistered files are silently skipped —
  always add the new file to that list in the same change. (Two dated
  `20260629_*` files — `token_valid`, `warehouses` — exist on disk but are **not
  yet registered**.)
- **Migrations are current through 085** (the runner registers 021→085; 044/048
  are intentionally absent). Notable recent ones:
  - `064` — ATMOS billing: `subscriptions` table + ATMOS columns on `payments` + `atmos_status` enum
  - `065` — `stock_ledger` (event-sourced authoritative on-hand per SKU group)
  - `066`/`067` — Yandex netting payment-order + product-name columns (payout "paid" signal / Payouts naming)
  - `069` — display-only card metadata (last4/expiry/holder) for direct binding
  - `070` — per-subscription `autorenew` flag
  - `071` — UNIQUE `(shop_id, order_id_external)` (dup orders inflate turnover→tier)
  - `072` — `agreed_amount_tiyin` (price the subscriber agreed to)
  - `073` — `is_grandfathered` (old-flat-price accounts keep price/access)
  - `074` — advisory turnover-derived tier columns (NOT entitlement)
  - `075` — add `biznes` to the `plan_type` enum
  - `076` — `cancelled_at` + `access_until` (cancellation promise)
  - `077` — staged price-change columns (`pending_amount_tiyin`/`_effective_date`/`_notified_at`)
  - `078` — `user_notices` table (throttled nudges)
  - `079` — `last_active_at` + `frozen_at` (account lifecycle)
  - `080` — `shops.stock_synced_at` (independent stock-refresh clock)

## Deployment

- **Server:** Hetzner VPS (Finland / Helsinki), nginx reverse proxy → Node.js.
- **Process manager:** pm2 (`daromadchi`).
- **Deploy flow:** push to `main` → GitHub Actions (`.github/workflows/deploy.yml`)
  SSHes to the VPS → `git` update → `rm -rf .next && npm run build` →
  `node scripts/apply-sql-migrations.mjs` → `pm2 restart daromadchi` → (re)install the
  cron schedule. Health is polled by `.github/workflows/ci.yml` against `/api/health`.
- **Domains:** `daromadchi.uz` and `www.daromadchi.uz` (both must work — for the
  extension and for the cross-host session cookie).

## Dates, weeks and the period pickers

`lib/period-week.ts` owns every week boundary and every range-paging decision.
Nothing else may derive one.

**Weeks run Monday→Sunday** (ISO-8601). The key format is `2026-W34`, zero-padded
so lexicographic comparison is chronological, and matching Postgres
`to_char(ordered_at, 'IYYY-"W"IW')` exactly — the SQL buckets and the JS labels
must describe the same week.

**Two traps this module exists to close, both of which shipped as bugs:**

1. **`toISOString()` converts to UTC.** For a seller at UTC+5, local midnight
   Monday is Sunday 19:00 UTC, so `monday.toISOString().slice(0,10)` names the
   *wrong day*. Use `localDateStr()`.
2. **Paging a week is not "shift 7 days".** The original code shifted both ends
   and then clamped the end to today, which re-anchored a Mon–Sun window to
   Thu–Wed the moment it caught up with the present — i.e. on the current week,
   the most-viewed range. `pageRange()` snaps a calendar week back to its Monday
   and lets it keep its Sunday even though that Sunday is in the future. A week
   that ends on Wednesday is not a week.

`canPageForward()` decides the "next" button from the week you are **on**, not
from its Sunday; the end-based test is what let the clamp fire.

**Two picker components share this module:** `DateRangePicker` (dashboard,
Orders) and `CalendarPicker` (P&L). They render differently — plain date inputs
versus a month grid — but both call `pageRange` / `canPageForward`. They each
owned a copy of the paging arithmetic until the copies drifted and a fix landed
on one and missed the other.

## Testing & guardrails

Tests run with `node --import tsx --test`. Modules importing `server-only` need
`--conditions=react-server`. Integration suites expect a real Postgres via
`DATABASE_URL`.

**Guardrail tests are the enforcement mechanism for the rules above.** Rather
than asserting behaviour, they scan the repository's own source and fail if a
banned pattern reappears:

| guard | bans |
|---|---|
| `lib/marketplace-readonly-guard.test.ts` | marketplace writes outside the audited writer |
| `lib/money/order-economics.guardrail.test.ts` | `coalesce(fee/cost, 0)` and `cost_price ?? 0` outside `lib/money` |
| `lib/period-week.guardrail.test.ts` | hand-rolled week boundaries, UTC day conversion, and a second copy of the paging clamp |

The money and week guards support a per-line opt-out — `// money-guard-ok: <reason>`
— for the handful of cases that genuinely are not the bug. The reason is
mandatory and the scanner reads code and comments in one pass, so the marker
cannot be smuggled in inside a string literal. **Prefer a per-line opt-out to a
file allowlist:** a file-wide exemption in the week guard is exactly how the P&L
picker kept its bug through the fix that was meant to remove it.

> ⚠️ **These guards do not currently run in CI.** The pipeline runs lint,
> typecheck and build only — no test job — so all 45 `test:*` scripts execute
> only when someone runs them by hand, and several have been failing on `main`
> unnoticed. See `AUDIT.md`.

## Key Conventions

1. **Cache tags:** `'product-data'` for products/KPIs, `'order-data'` for orders/revenue.
2. **Cache invalidation:** Always `revalidateTag(tag, { expire: 0 })`, never `'max'`.
3. **New DB columns:** Add via SQL migration first (and register it in
   `scripts/apply-sql-migrations.mjs`); query via raw SQL until the migration is
   confirmed run before adding to the Drizzle schema.
4. **Money is integer tiyin.** All charged/settlement amounts are tiyin (1 so'm =
   100 tiyin); `PLAN_PRICES_TIYIN` is the single source of truth and the charged
   amount is always derived server-side, never from the client.
5. **Entitlement vs. tier.** Feature gating reads `users.plan` (what was paid).
   `users.derived_tier` is an advisory turnover recommendation and must never gate
   access — only nudges read it.
6. **Marketplace APIs:** Read-only by default. The only exception is the opt-in,
   per-shop **Stock-sync (edit)** mode through the single audited writer + its
   allowlist, plus the separately-allowlisted oversell order-cancel path. Every other
   marketplace write is prohibited. See `AGENTS.md`.
7. **Extension auth:** Uses the `extension_token` column via raw SQL, not a Drizzle field.
   (Deliberate, per convention 3 — but it means `drizzle-kit push` does not know
   the column exists. Never run `push` against production.)
8. **Profit has one definition:** `revenue − fees − COGS`, computed in
   `lib/money/`. Never coalesce a missing fee or cost to `0` — keep the null and
   let the UI say "—". The guardrail test enforces this.
9. **Week and date maths lives in `lib/period-week.ts`.** Never `getDay()`,
   never `toISOString().slice(0,10)` for a calendar day, never a second copy of
   the range-paging clamp.
10. **Keep the docs in sync:** when you add a migration or a user-facing
   auth/privacy/payments feature, update **this file** *and* `public/architecture.html`
   in the same change — including the "current through NNN" migration line here and
   the `Migrations → NNN` label in the diagram.

## Cross-marketplace stock (identical SKUs)

When the same seller article (SKU) is listed on more than one marketplace, Daromadchi
treats those listings as one group (normalized SKU as the match key). For FBS listings
the group shares a **single physical pool** — the same units are advertised on each
marketplace at once — so the true leftover is **`MAX(stock across the group) − SUM(all
pending orders across the group)`**, not the sum of per-listing numbers (which would
invent stock and invite overselling). FBO/FBY warehouses are independent per
marketplace and are summed instead. This is the math in `lib/db/stock-groups.ts` and
`lib/db/products.ts`, with an event-sourced authoritative on-hand in `stock_ledger`
(migration 065).

**Read-only shops (the default):** a pure display calculation — the corrected leftover
is shown but **never written back** to any marketplace.

**Stock-sync shops (opt-in):** the same `MAX − pending` number is additionally written
back to each opted-in listing (stock quantity only) so the marketplaces stop showing a
unit another marketplace already sold. That write path is entirely separate from the
read-only math and only ever touches shops whose owner turned edit mode on.
