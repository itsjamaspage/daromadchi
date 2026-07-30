# DB Migration Runbook — Supabase → self-hosted Postgres

This runbook moves the production Postgres off Supabase (currently at
`ajwtpyrucfcrdndedumt.supabase.co`, free tier, unhealthy, no backups)
onto Postgres 17 running on the same Hetzner VPS the app runs on.

**Everything runs from the GitHub Actions tab. No SSH client needed.**
You can execute it from a phone browser if you can hit github.com.

## Pre-flight checklist

Before triggering anything:

- [ ] You are logged into GitHub with push access to `itsjamaspage/daromadchi`.
- [ ] You have ~20 minutes of attention (split however — install/restore
      are 3 min each; the swap is the 5-15 min downtime bit).
- [ ] It's not peak business hours for your sellers. This is when the
      swap causes ~5 min of app downtime.

## The stages

Each stage is one click at
`Actions → DB · Migrate (Supabase → self-hosted) → Run workflow → pick "stage"`.
Wait for the green ✓ before triggering the next stage.

### Stage 0 — Backup (do this first, always)

1. Go to `Actions → DB · Backup Postgres → Run workflow`.
2. Wait for green ✓ (~2 min on a 75 MB DB).
3. Download the artifact `daromadchi-db-backup` — save the file on
   your laptop. This is your safety net if EVERYTHING else fails.
   You now have a portable dump you could restore into any Postgres
   on the planet.

The workflow also keeps 14 dumps on the VPS at `/var/backups/daromadchi/`
and runs itself nightly at 03:00 UTC from now on.

### Stage 1 — Install (no downtime)

1. `Actions → DB · Migrate → Run workflow → stage: install`
2. What it does:
   - Installs Postgres 17 from the official PGDG apt repo.
   - Creates `daromadchi` role + `daromadchi` database.
   - Generates a strong random password, saves it to
     `/root/.daromadchi-pg-password` on the VPS (root-only readable).
   - Locks `pg_hba.conf` to `127.0.0.1` only. Postgres is NOT reachable
     from the internet.
3. Idempotent — running twice does nothing the second time (unless
   `force: true`).
4. Expected duration: 2-4 min.

### Stage 2 — Restore (no downtime, still on Supabase)

1. `Actions → DB · Migrate → Run workflow → stage: restore`
2. What it does:
   - Picks the newest dump from `/var/backups/daromadchi/`.
   - `pg_restore` into the local `daromadchi` DB.
   - Refuses to run if the local DB already has tables (safety).
     Re-run with `force: true` if you want to wipe and re-restore.
3. Watch the tail of the log for per-table row counts. If a critical
   table has 0 rows when it shouldn't, stop and take a fresh backup.
4. Expected duration: 3-5 min for a 75 MB DB.

### Stage 3 — Verify (read-only, no downtime, still on Supabase)

1. `Actions → DB · Migrate → Run workflow → stage: verify`
2. What it does:
   - Connects to BOTH Supabase and the local DB.
   - `SELECT count(*)` on every table in each.
   - Prints a diff table. Every row must say `ok`.
3. If ANY row says `MISMATCH`, do NOT run swap. Take a fresh backup
   (Stage 0), re-run Stage 2 restore with `force: true`, re-run verify.
4. Expected duration: <1 min.

### Stage 4 — Swap (⚠️ 5-15 min downtime starts here)

1. `Actions → DB · Migrate → Run workflow → stage: swap`
2. What it does:
   - Backs up the current `.env` to `.env.pre-migration-<timestamp>`.
   - Rewrites `DATABASE_URL` to point at `127.0.0.1:5432`.
   - `pm2 restart daromadchi`.
   - Polls `/api/health` for up to 60s. Fails loud if the app doesn't
     become healthy.
3. If the workflow exits green ✓: **you're on the new DB.** Open the
   app in a browser, log in, click through orders/products/dashboard.
4. If the workflow exits red ✗: go straight to Stage 5 rollback.
5. Expected duration: 1-2 min.

### Stage 5 — Rollback (safety net, use if Stage 4 or post-swap smoke test breaks)

1. `Actions → DB · Migrate → Run workflow → stage: rollback`
2. What it does:
   - Restores the newest `.env.pre-migration-*` backup.
   - `pm2 restart daromadchi`.
   - Polls `/api/health`.
3. You're back on Supabase. The local DB is untouched — investigate
   later, no time pressure.
4. Expected duration: 1-2 min.

**Rollback is safe as long as Supabase is still alive.** Do not delete
the Supabase project until you've been running on the new DB for 24-48h.

### Stage 6 (later, once stable) — Retire Supabase

24-48 hours after a successful swap, if the app has been happy:

1. Log into supabase.com, open the `itsjamaspage's Project` project.
2. **Verify no traffic**: Project Overview → "Total Requests" for
   last 60 min should be 0 (or very close). If it's not, someone is
   still hitting it — investigate before deleting.
3. Settings → General → Pause project (soft-delete, 30-day recovery).
4. After another week if nothing has broken: Settings → General →
   Delete project.

Also open a follow-up PR (or ask Claude for one) that removes:
- Supabase env vars from `.github/workflows/ci.yml`
- `.env.example` Supabase block
- README "Deploy on Vercel" template blurb
- `ARCHITECTURE.md` `vercel.json schedule` references (out of date)
- `migrations/functions/uzum-sync/` directory (Deno edge function
  superseded by the VPS crontab)

## What to check on each stage's log

| Stage | What "success" looks like in the log |
|---|---|
| Backup | `Wrote /var/backups/daromadchi/dump-<STAMP>.dump (75M)` at the bottom |
| Install | `SELECT current_database(), current_user, version();` returns a Postgres 17 row |
| Restore | `Table row counts after restore:` followed by non-zero rows |
| Verify | Every table row prints `ok`, final line says `SUCCESS. Every table matches.` |
| Swap | `SUCCESS. App is up on the new local DB.` and a backup .env path |
| Rollback | `SUCCESS. App is back on Supabase.` |

## Post-migration: nightly backups

The backup workflow now runs itself nightly at 03:00 UTC — no action
needed. Latest 14 dumps rotate on the VPS at `/var/backups/daromadchi/`.
Every dump also uploads as a GitHub Actions artifact retained 30 days.

**Recommended:** every 3 months, download an artifact and do a test
restore into a scratch Postgres locally (or a spare VPS). "Backups you
never restore" is the security finding this whole migration also fixes.

## Emergency contact

If something breaks between the swap and the rollback: rollback is one
click and takes <2 min. If the rollback also fails, the pre-migration
`.env.pre-migration-*` file is on the VPS at
`/var/www/daromadchi/.env.pre-migration-<STAMP>` — SSH in, copy it back
to `.env`, `pm2 restart daromadchi`.

If the VPS itself is unreachable, the artifact you downloaded in Stage 0
can be restored into any Postgres (Neon, another VPS, laptop) and the
app repointed at it via `DATABASE_URL`.
