# Daromadchi — Application Architecture

Multi-marketplace seller dashboard for **Uzum Market and Yandex Market**.

> Wildberries support was removed entirely (code + the `marketplace_type` enum);
> the platform now covers Uzum Market and Yandex Market only.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.4 (App Router, React 19, Turbopack) |
| Database | PostgreSQL 17 (self-hosted on the same Hetzner VPS) |
| ORM | Drizzle ORM |
| Auth | NextAuth v5 — Credentials (email + password, bcrypt) + optional Google OAuth; JWT sessions |
| Styling | Tailwind CSS v4 + CSS custom properties (theme tokens) |
| Analytics | Google Analytics 4 via `@next/third-parties`, consent-gated and production-only |
| Hosting | Hetzner VPS (Finland / Helsinki), nginx reverse proxy → Node.js (pm2) |
| Extension | Chrome Manifest V3 |

## Directory Structure

```
app/
  dashboard/           # Authenticated dashboard pages
    analytics/         # Margin analysis, product profitability
    products/          # Product list with cost price editing
    stocks/            # Warehouse stock overview
    orders/            # Order history
    pnl/               # Profit & Loss
    payouts/           # Marketplace settlements / payouts
    unit-economics/    # Per-product unit economics
    billing/           # Subscription plan & payment history
    settings/          # Shop tokens, preferences
    sync/              # Manual sync trigger
    account/           # Account management, incl. "Request account deletion"
    ...                # alerts, notifications, calculator, referral, team, etc.
  api/
    cron/sync/             # Scheduled marketplace sync (all shops)
    cron/stock-sync/       # Scheduled cross-marketplace stock reconcile / write-back
    cron/telegram-digest/  # Telegram summary
    uzum/sync/             # Manual Uzum sync
    yandex/sync/           # Manual Yandex sync
    billing/expire-plans/  # Cron: downgrade lapsed paid plans to free
    account/request-deletion/  # User-facing account-deletion request (notifies operator)
    auth/delete-account/       # Admin-only hard delete by email
    products/update/       # Cost price updates
    extension/             # Extension API endpoints (Bearer token auth)
    telegram/              # Telegram bot integration
    ...
  login/               # Auth pages
  pricing/             # Public pricing page
  privacy/ terms/ cookies/ compliance/   # Public legal pages (uz/ru/en)

lib/
  db/                  # Drizzle schema, queries, cached data functions
    schema.ts          # Database schema (~34 tables)
    products.ts        # Product queries (unstable_cache, tags: ['product-data'])
    orders.ts          # Order queries (unstable_cache, tags: ['order-data'])
    kpis.ts revenue.ts pnl.ts payouts.ts unit-economics.ts   # Aggregations
    billing.ts         # Plan + payment-history reads
  uzum/sync.ts         # Uzum Market API sync logic
  yandex/sync.ts       # Yandex Market API sync logic
  marketplace/
    stock-writer.ts    # The single audited stock-quantity writer (opt-in edit mode)
    order-cancel.ts    # The single audited oversell order-cancel path
  marketplace-readonly-guard.ts   # Method/URL allowlist enforcing read-only-by-default
  billing/plans.ts     # Plan definitions (free / pro / pro_plus)
  auth/
    session.ts         # getCurrentUser(), getUserFromBearerToken()
    config.ts          # NextAuth configuration (Credentials + optional Google)
  api/auth.ts          # Extension auth (getExtensionUser), plan logic
  crypto.ts            # API key encryption/decryption (AES-256-CBC)
  telegram.ts          # Telegram message sending
  cookie-consent.ts    # GA4 consent gate

components/dashboard/  # Shared dashboard components
extension/             # Chrome extension (see Extension section)
proxy.ts               # Middleware — CORS, routing
```

## Data Flow

### Marketplace Sync

```
Marketplace APIs (Uzum, Yandex)
        │
        ▼
  /api/cron/sync  ◄── Called by VPS system crontab via cron-runner.sh
        │               Currently: every 5 min (*/5 * * * *)
        ▼
  lib/{uzum,yandex}/sync.ts
        │
        ▼
  PostgreSQL (products, orders, stocks tables)
        │
        ▼
  unstable_cache (revalidate: 30s, tags: ['product-data', 'order-data'])
        │
        ▼
  Dashboard pages read cached data
```

**Sync frequency:** Every 5 min (`*/5 * * * *` in the VPS crontab, installed by
`.github/workflows/deploy.yml`). A separate `/api/cron/stock-sync` job (also every
5 min) handles cross-marketplace stock reconciliation and the opt-in stock
write-back. The sync endpoints are protected by `CRON_SECRET`.

**Cache invalidation:** Mutation endpoints (cost price update, shop token save, etc.)
call `revalidateTag('product-data', { expire: 0 })` for immediate cache expiration.
The `{ expire: 0 }` flag is critical — `'max'` uses stale-while-revalidate and serves
stale data on the first request after invalidation.

### Manual Sync

Users can trigger sync from `/dashboard/sync`, which calls `/api/{uzum,yandex}/sync`.
This is authenticated via NextAuth session.

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

## Payments

- **No direct payment integrations in the code.** The former Payme and Click direct
  integrations (`lib/billing/payme.ts`, `lib/billing/click.ts`, and their routes)
  were **removed entirely**.
- **Atmos (planned, not yet integrated).** Billing is moving to the Atmos payment
  aggregator (which itself provides Payme, Click, Uzcard, Humo, Visa). Atmos is at the
  onboarding stage — **there is no Atmos code in the repo yet**. Card data will be
  entered on the aggregator's side and **never touches the app**.
- **What exists today:** plan definitions in `lib/billing/plans.ts`
  (free / pro / pro_plus); the `payments` table (retained, including the `payer_email`
  snapshot kept for tax/accounting); and `/api/billing/expire-plans`, a daily cron
  that downgrades lapsed paid plans to `free`.

## Account Deletion & Data Retention

- **User-facing request** — `/api/account/request-deletion`: a logged-in user requests
  deletion; the app notifies the operator (email to `privacy@daromadchi.uz` via
  `sendAccountDeletionRequest` + a Telegram message to the admin chat) and confirms
  receipt. It does **not** delete anything itself.
- **Admin action** — `/api/auth/delete-account` (guarded by `x-admin-secret`): hard-deletes
  users by email. Personal data is removed via the `users` FK cascade.
- **Financial/tax records survive deletion.** `payments.user_id` is
  `ON DELETE SET NULL` (migration 055), so the payer link is severed but the payment
  row is retained; `payments.payer_email` (migration 056) preserves who paid for tax
  purposes.
- **No automatic retention purge.** A 30-day post-cancellation auto-purge was built and
  then **removed**. Nothing auto-deletes accounts. The `users.plan_cancelled_at` column
  remains in the schema as an unused legacy column (not read or written by any code; not
  dropped, to avoid a destructive migration).

## Authentication

### Web App Auth

- NextAuth v5 with a **Credentials** provider (email/password, bcrypt) and an **optional
  Google OAuth** provider (rendered only when the Google env vars are configured).
- JWT sessions stored as HTTP-only cookies (no DB session adapter).
- `getCurrentUser()` reads the session → looks up the user by email in the DB.
- `getUserFromBearerToken()` decodes the NextAuth JWT for API calls.

### Extension Auth (Token-based)

The extension uses a separate token-based auth system (not NextAuth JWTs):

1. User installs the extension and visits `daromadchi.uz` / `www.daromadchi.uz`.
2. `content-daromadchi.js` runs on the Daromadchi site.
3. It calls `GET /api/extension/me` with `credentials: 'include'` (session cookie).
4. The server generates an opaque token and stores it in `users.extension_token`.
5. The content script hands the token to the background service worker.
6. Background stores it in `chrome.storage.local` as `daromadchi_token`.
7. Subsequent extension API calls send `Authorization: Bearer <token>`.
8. The server validates via `getExtensionUser()` (`WHERE extension_token = ?`).

**Note:** `extension_token` is intentionally NOT in the Drizzle schema
(`lib/db/schema.ts`); it is read via raw SQL in `lib/api/auth.ts`
(`sql\`extension_token = ${token}\``). This is a deliberate convention (see Key
Conventions), and the flow is live in production.

## Chrome Extension

### Architecture

Chrome Manifest V3 extension with a service worker (`background.js`).

### Content Scripts

| Script | Runs on | Purpose |
|---|---|---|
| `content-daromadchi.js` | `daromadchi.uz`, `www.daromadchi.uz` | Auth sync — fetches token from app, sends to background |
| `content.js` | `uzum.uz`, `*.uzum.uz` | Injects analytics overlay on Uzum product pages |
| `content-yandex.js` | `partner.market.yandex.ru`, `market.yandex.*` | Injects analytics on Yandex Market |

> `extension/content-wb.js` still ships in the extension bundle but is **dead** —
> Wildberries was removed from the platform. It should be dropped in a dedicated
> extension cleanup/republish.

### Extension API Endpoints

All use `getExtensionUser()` for auth (Bearer token, NOT session cookie):

| Endpoint | Purpose |
|---|---|
| `GET /api/extension/me` | Auth handshake, returns/generates token (uses session cookie) |
| `GET /api/extension/stats` | Dashboard summary stats |
| `GET /api/extension/products` | Product list for popup |
| `GET /api/extension/product` | Single product details |
| `POST /api/extension/send-alerts` | Trigger stock/price alerts |
| `POST /api/extension/send-daily-summary` | Trigger daily Telegram summary |
| `GET /api/extension/telegram-link` | Generate Telegram link token |
| `GET /api/extension/telegram-status` | Check Telegram connection |

### Extension Storage (`chrome.storage.local`)

| Key | Value |
|---|---|
| `daromadchi_token` | Auth token for API calls |
| `daromadchi_connected` | Boolean — is user authenticated |
| `daromadchi_email` | User's email |
| `tgStatus` | Telegram connection status |
| `cachedStats` | Cached dashboard stats |
| `cacheTime` | Timestamp of cached stats |

## Analytics & Privacy

- **Google Analytics 4** is loaded via `@next/third-parties` (`app/components/Analytics.tsx`)
  but only when **every** gate passes: running in production, a `NEXT_PUBLIC_GA_MEASUREMENT_ID`
  is set, **and** the visitor has explicitly accepted analytics cookies. Until consent,
  `gtag.js` is never even fetched.
- **No PII** (emails, user IDs, shop names) is ever sent to GA — only default,
  anonymous page-view collection.
- Consent is managed in `lib/cookie-consent.ts`; the public `/cookies` page lets users
  re-open the banner and change the choice. Full detail lives on the `/privacy` and
  `/cookies` legal pages.

## Theming

Two themes: light and dark. Controlled by `data-theme` on `<html>`.

**Important:** Do NOT use Tailwind `dark:` prefix. Use CSS variables:
- `var(--bg-base)`, `var(--bg-card)`, `var(--bg-card2)`
- `var(--text-base)`, `var(--text-muted)`, `var(--text-dim)`
- `var(--border)`, `var(--border2)`
- `var(--c1)` (brand primary), `var(--c2)` (brand secondary)

Light theme has a blue canvas (`#83c0f7`). Dark theme is Revolut-style black (`#161616`).

## Telegram Integration

- Bot sends order notifications, stock alerts, and daily/weekly summaries.
- Connected via `/api/telegram/webhook` (Telegram webhook → app).
- User links their account at `/dashboard/settings` → generates a one-time token.
- Notifications controlled by user preferences (`notif_new_orders`, etc.).

## Scheduled Jobs

Installed into the VPS system crontab by `deploy.yml` → `cron-runner.sh`, each
protected by `CRON_SECRET`:

| Job | Schedule (server, UTC) | Endpoint |
|---|---|---|
| Marketplace sync | Every 5 min (`*/5 * * * *`) | `/api/cron/sync` |
| Stock-sync | Every 5 min (`*/5 * * * *`) | `/api/cron/stock-sync` |
| Telegram digest | Hourly at :05 (`5 * * * *`) | `/api/cron/telegram-digest` |
| Expire plans | Daily 03:15 (`15 3 * * *`) | `/api/billing/expire-plans` |

> There is **no** retention-purge cron — that feature was removed.

## Data Backups

Nightly Postgres backups run via `.github/workflows/db-backup.yml` (schedule
`0 3 * * *` = 03:00 UTC, plus manual `workflow_dispatch`). GitHub Actions SSHes into
the VPS and runs `pg_dump` **on the VPS itself** (Postgres is bound to 127.0.0.1),
keeping the **14 newest rotated dumps** at `/var/backups/daromadchi/`.

**The dump never leaves the VPS** — it is not copied off-host or uploaded as a GitHub
artifact, so the full DB (emails, password hashes, payments, Telegram IDs, encrypted
marketplace tokens) stays entirely on our own infrastructure and GitHub is not a data
processor. (The former GitHub-artifact upload was removed.)

## Database & Migrations

- Schema is defined in `lib/db/schema.ts` (Drizzle, ~34 tables — `users`, `shops`,
  `orders`, `order_items`, `products`, `payments`, `unit_economics_items`,
  `stock_write_log`, `order_cancel_log`, `stock_notify_state`, `stock_sync_state`,
  settlement tables, etc.).
- SQL migrations live in `migrations/migrations/NNN_*.sql` and are applied on deploy by
  `scripts/apply-sql-migrations.mjs`.
- **A migration file only runs if it is registered in the `MIGRATIONS` array in
  `scripts/apply-sql-migrations.mjs`.** Unregistered files are silently skipped — always
  add the new file to that list in the same change.
- Migrations are current through **057**. Notable recent ones:
  - `054` — `orders.marketplace_status`
  - `055` — privacy/retention (`plan_cancelled_at`; `payments.user_id` → `ON DELETE SET NULL`)
  - `056` — `payments.payer_email` (tax retention)
  - `057` — dropped `'wildberries'` from the `marketplace_type` enum

## Deployment

- **Server:** Hetzner VPS (Finland / Helsinki), nginx reverse proxy → Node.js.
- **Process manager:** pm2 (`daromadchi`).
- **Deploy flow:** push to `main` → GitHub Actions (`.github/workflows/deploy.yml`)
  SSHes to the VPS → `git` update → `rm -rf .next && npm run build` →
  `node scripts/apply-sql-migrations.mjs` → `pm2 restart daromadchi` → (re)install the
  cron schedule. Health is polled by `.github/workflows/ci.yml` against `/api/health`.
- **Database:** PostgreSQL on the same Hetzner server.
- **Domains:** `daromadchi.uz` and `www.daromadchi.uz` (both must work for the extension).

## Key Conventions

1. **Cache tags:** `'product-data'` for products/KPIs, `'order-data'` for orders/revenue.
2. **Cache invalidation:** Always use `revalidateTag(tag, { expire: 0 })`, never `'max'`.
3. **New DB columns:** Add via SQL migration first (and register it in
   `scripts/apply-sql-migrations.mjs`); query via raw SQL until the migration is
   confirmed run before adding to the Drizzle schema.
4. **Marketplace APIs:** Read-only by default. The one exception is the opt-in, per-shop
   **Stock-sync (edit)** mode, which — after the seller consents — updates ONLY the stock
   quantity (ostatok) through the single audited writer (`lib/marketplace/stock-writer.ts`)
   and its method-exact allowlist, plus a separately-allowlisted oversell order-cancel
   path (`lib/marketplace/order-cancel.ts`). Every other marketplace write is prohibited.
   See "Cross-marketplace stock" below and `AGENTS.md`.
5. **Extension auth:** Uses the `extension_token` column via raw SQL, not a Drizzle schema field.

## Cross-marketplace stock (identical SKUs)

When the same seller article (SKU) is listed on more than one marketplace, Daromadchi
treats those listings as one group (normalized SKU as the match key). For FBS listings
the group shares a **single physical pool** — the same units are advertised as "N
available" on each marketplace at once — so the true leftover is **`MAX(stock across the
group) − SUM(all pending orders across the group)`**, not the sum of the per-listing
numbers (summing would invent stock that isn't there and invite overselling). FBO/FBY
warehouses are independent per marketplace and are summed instead. This is the math in
`lib/db/stock-groups.ts` and `lib/db/products.ts`.

**Read-only shops (the default):** this is a pure display calculation. Daromadchi shows
the corrected leftover but **never writes anything back** to any marketplace — the
identical-SKU listings are only reconciled in the app's own view.

**Stock-sync shops (opt-in):** the same `MAX − pending` number is additionally written
back to each opted-in listing (stock quantity only) so the marketplaces stop showing a
unit that another marketplace already sold. That write path is entirely separate from the
read-only math above and only ever touches shops whose owner turned edit mode on.
