# Daromadchi

Seller analytics dashboard for Uzbek marketplaces (Uzum, Yandex Market,
Wildberries). Multi-marketplace stock, orders, unit economics, P&L,
Telegram digest.

## Stack

- Next.js 15 (App Router)
- PostgreSQL 17 (self-hosted on the same VPS) via Drizzle ORM
- NextAuth v5 (Credentials + bcrypt) for auth
- pm2 process manager, nginx reverse proxy
- Deploy: push to `main` → SSH → `git pull && npm ci && npm run build && pm2 restart`
- Cron: system crontab on the VPS hits `/api/cron/*` endpoints protected
  by `CRON_SECRET`

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
`.github/workflows/db-backup.yml` — 14 dumps rotate on the VPS, 30-day
retention as GitHub artifacts.

## Docs

- Architecture overview: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Agents / repo conventions: [`AGENTS.md`](./AGENTS.md)
