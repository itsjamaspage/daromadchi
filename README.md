# Daromadchi

Seller analytics dashboard for Uzbek marketplaces (Uzum Market, Yandex
Market). Multi-marketplace stock, orders, unit economics, P&L, Telegram
digest.

## Stack

- Next.js 16 (App Router, React 19)
- PostgreSQL 17 (self-hosted on the same VPS) via Drizzle ORM
- NextAuth v5 (Credentials + bcrypt, optional Google OAuth) for auth
- Google Analytics 4 (consent-gated, production-only)
- pm2 process manager, nginx reverse proxy
- Deploy: push to `main` → SSH → `git pull && npm ci && npm run build && pm2 restart`
- Cron: system crontab on the VPS hits `/api/cron/*` (+ `/api/billing/expire-plans`)
  endpoints protected by `CRON_SECRET`

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

Open http://localhost:3000.

## Deployment

Push to `main`. GitHub Actions (`.github/workflows/deploy.yml`) SSHes to
the VPS and does the build. Health-checked by `.github/workflows/ci.yml`
polling `/api/health`.

Nightly database backups run at 03:00 UTC via
`.github/workflows/db-backup.yml`: GitHub Actions SSHes to the VPS and runs
`pg_dump` there, keeping the 14 newest rotated dumps at
`/var/backups/daromadchi/`. The dump stays on the VPS only — it is never
uploaded off-host or stored as a GitHub artifact.

## Docs

- Architecture overview: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Agents / repo conventions: [`AGENTS.md`](./AGENTS.md)
