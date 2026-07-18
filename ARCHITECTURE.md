# Daromadchi — Application Architecture

Multi-marketplace seller dashboard for Uzum Market, Yandex Market, and Wildberries.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.4 (App Router, React 19, Turbopack) |
| Database | PostgreSQL (Hetzner) |
| ORM | Drizzle ORM |
| Auth | NextAuth (email + password, JWT sessions) |
| Styling | Tailwind CSS v4 + CSS custom properties (theme tokens) |
| Hosting | Hetzner VPS (nginx reverse proxy → Node.js) |
| Extension | Chrome Manifest V3 |

## Directory Structure

```
app/
  dashboard/           # Authenticated dashboard pages
    analytics/         # Margin analysis, product profitability
    advertising/       # Ad campaigns, DRR, CPO, ROAS metrics
    products/          # Product list with cost price editing
    stocks/            # Warehouse stock overview
    orders/            # Order history
    pnl/               # Profit & Loss
    settings/          # Shop tokens, preferences
    sync/              # Manual sync trigger
    ...
  api/
    cron/sync/         # Scheduled sync (all shops, all marketplaces)
    cron/telegram-digest/  # Daily Telegram summary
    uzum/sync/         # Manual Uzum sync
    yandex/sync/       # Manual Yandex sync
    wildberries/sync/  # Manual Wildberries sync
    products/update/   # Cost price updates
    extension/         # Extension API endpoints (token auth)
    telegram/          # Telegram bot integration
    billing/           # Payment processing (Click, Payme)
    ...
  login/               # Auth pages
  pricing/             # Public pricing page

lib/
  db/                  # Drizzle schema, queries, cached data functions
    schema.ts          # Database schema (users, shops, products, orders, etc.)
    products.ts        # Product queries (unstable_cache, tags: ['product-data'])
    orders.ts          # Order queries (unstable_cache, tags: ['order-data'])
    kpis.ts            # KPI aggregations
    revenue.ts         # Revenue queries
  uzum/sync.ts         # Uzum Market API sync logic
  yandex/sync.ts       # Yandex Market API sync logic
  wildberries/sync.ts  # Wildberries API sync logic
  auth/
    session.ts         # getCurrentUser(), getUserFromBearerToken()
    config.ts          # NextAuth configuration
  api/auth.ts          # Extension auth (getExtensionUser), plan logic
  crypto.ts            # API key encryption/decryption
  telegram.ts          # Telegram message sending

components/dashboard/  # Shared dashboard components
  ProductsTable.tsx    # Products table with cost price editing
  AdvertisingView.tsx  # Ad campaigns table with DRR column
  Sidebar.tsx          # Navigation sidebar
  ...

extension/             # Chrome extension (see Extension section)

proxy.ts               # Middleware — CORS, routing
```

## Data Flow

### Marketplace Sync

```
Marketplace APIs (Uzum, Yandex, WB)
        │
        ▼
  /api/cron/sync  ◄── Called by external cron (vercel.json schedule)
        │               Currently: once/day at midnight (0 0 * * *)
        ▼
  lib/{uzum,yandex,wildberries}/sync.ts
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

**Sync frequency:** Once per day (`0 0 * * *` in vercel.json). The sync endpoint
is protected by `CRON_SECRET`. Each shop is synced in batches of 5 concurrent requests.

**Cache invalidation:** Mutation endpoints (cost price update, shop token save, etc.)
call `revalidateTag('product-data', { expire: 0 })` for immediate cache expiration.
The `{ expire: 0 }` flag is critical — `'max'` uses stale-while-revalidate and serves
stale data on the first request after invalidation.

### Manual Sync

Users can trigger sync from `/dashboard/sync` which calls `/api/{uzum,yandex,wildberries}/sync`.
This is authenticated via NextAuth session.

### Marketplace API Rules (IMMUTABLE)

**The app MUST NEVER send PUT, PATCH, or DELETE requests to any external marketplace API.**
POST is only allowed when the marketplace API requires POST for READ operations
(e.g. Yandex offer-mappings returns 405 on GET). See `lib/marketplace-readonly-guard.ts`.

## Authentication

### Web App Auth

- NextAuth with email/password (credentials provider)
- JWT sessions stored as HTTP-only cookies
- `getCurrentUser()` reads session → looks up user by email in DB
- `getUserFromBearerToken()` decodes NextAuth JWT for API calls

### Extension Auth (Token-based)

The extension uses a separate token-based auth system (not NextAuth JWTs):

1. User installs extension, visits `daromadchi.uz` or `www.daromadchi.uz`
2. Content script (`content-daromadchi.js`) runs on the Daromadchi site
3. It calls `GET /api/extension/me` with `credentials: 'include'` (uses session cookie)
4. Server generates an opaque token (`crypto.randomUUID() + crypto.randomBytes(16)`)
5. Token is stored in `users.extension_token` column (raw SQL, not in Drizzle schema)
6. Content script sends token to background service worker via `chrome.runtime.sendMessage`
7. Background stores token in `chrome.storage.local` as `daromadchi_token`
8. All subsequent extension API calls use `Authorization: Bearer <token>`
9. Server validates via `getExtensionUser()` which queries `WHERE extension_token = ?`

**Important:** The `extension_token` column is NOT in the Drizzle schema (`lib/db/schema.ts`).
It's queried via raw SQL (`sql\`extension_token = ...\``) to avoid crashes if the DB migration
hasn't been run. The migration file is at `drizzle/migrations/add_extension_token.sql`.

### Extension Auth — Known Issues / Pending

- **DB migration required:** `add_extension_token.sql` must be run on the production DB:
  ```bash
  psql $DATABASE_URL -f drizzle/migrations/add_extension_token.sql
  ```
- **Extension must be republished** to Chrome Web Store (version 2.3.0 with new auth flow)
- Until migration + republish, extension auth will not work in production

## Chrome Extension

### Architecture

Chrome Manifest V3 extension with service worker (`background.js`).

### Content Scripts

| Script | Runs on | Purpose |
|---|---|---|
| `content-daromadchi.js` | `daromadchi.uz`, `www.daromadchi.uz` | Auth sync — fetches token from app, sends to background |
| `content.js` | `uzum.uz`, `*.uzum.uz` | Injects analytics overlay on Uzum product pages |
| `content-yandex.js` | `partner.market.yandex.ru`, `market.yandex.*` | Injects analytics on Yandex Market |
| `content-wb.js` | `seller.wildberries.ru`, `wildberries.*` | Injects analytics on Wildberries |

### Data Flow

```
User visits marketplace page (e.g. uzum.uz/product/...)
        │
        ▼
Content script extracts product info from page DOM
        │
        ▼
Sends message to background.js
        │
        ▼
Background calls /api/extension/product (Bearer token auth)
        │
        ▼
Response includes cost price, margin, profit data
        │
        ▼
Content script renders overlay widget on the page
```

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

## Theming

Two themes: light and dark. Controlled by `data-theme` attribute on `<html>`.

**Important:** Do NOT use Tailwind `dark:` prefix. Use CSS variables:
- `var(--bg-base)`, `var(--bg-card)`, `var(--bg-card2)`
- `var(--text-base)`, `var(--text-muted)`, `var(--text-dim)`
- `var(--border)`, `var(--border2)`
- `var(--c1)` (brand primary), `var(--c2)` (brand secondary)

Light theme has a blue canvas (`#83c0f7`). Dark theme is Revolut-style black (`#161616`).

## Telegram Integration

- Bot sends order notifications, stock alerts, and daily summaries
- Connected via `/api/telegram/webhook` (Telegram webhook → app)
- User links account at `/dashboard/settings` → generates a one-time token
- Notifications controlled by user preferences (`notif_new_orders`, etc.)

## Scheduled Jobs

| Job | Schedule | Endpoint |
|---|---|---|
| Marketplace sync | Daily at midnight | `/api/cron/sync` |
| Telegram digest | Daily at 05:00 | `/api/cron/telegram-digest` |

Both are triggered externally (vercel.json crons or system cron on Hetzner)
and protected by `CRON_SECRET` header.

## Deployment

- **Server:** Hetzner VPS with nginx reverse proxy
- **Process manager:** PM2 (or similar)
- **Deploy flow:** Push to `main` → SSH into server → `git pull && npm run build && pm2 restart`
- **Database:** PostgreSQL on same Hetzner server
- **Domains:** `daromadchi.uz` and `www.daromadchi.uz` (both must work for extension)

## Key Conventions

1. **Cache tags:** `'product-data'` for products/KPIs, `'order-data'` for orders/revenue
2. **Cache invalidation:** Always use `revalidateTag(tag, { expire: 0 })`, never `'max'`
3. **New DB columns:** Add via SQL migration first, query via raw SQL until migration is confirmed run. Do NOT add to Drizzle schema until the column exists in production DB.
4. **Marketplace APIs:** Read-only. Never write data to marketplace APIs.
5. **Extension auth:** Uses `extension_token` column via raw SQL, not Drizzle schema field.
