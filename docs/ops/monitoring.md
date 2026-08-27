# Deploy & liveness monitoring

Two safeguards added after the 2025-08-27 incident, where the app served a broken
build for 30+ minutes while PM2 reported `online` and nothing paged. Both exist to
measure **work**, not process state.

## The incident, briefly

A deploy left `.next` referencing a Next internal
(`setup-node-env.external.js`) that was absent from the installed `node_modules` —
a build/modules skew. `npm run build` had exited 0; the failure only appeared at
**server boot**, when instrumentation could not load. The crontab kept firing
`cron-runner.sh sync`, curl kept hitting the endpoint, every call failed, and the
failures were logged — but no one watches a log, and PM2 "online" means the
process exists, not that a sync completed.

Two gaps, two fixes:

1. **"build exited 0" ≠ "the server boots and serves."** → a post-deploy smoke gate.
2. **PM2 "online" ≠ "sync is completing."** → a DB-freshness watchdog.

## How sync is actually driven (matters for the watchdog)

The VPS **system crontab** → `cron-runner.sh <job>` → HTTP GET the Next app. There
is no in-process scheduler (`instrumentation.ts` only registers the Telegram
webhook). So the failure to catch is "the app is down," and any check that lives
*inside* the app — an `/api/health` poll, a cron-runner job — is down with it. The
watchdog therefore runs from its own crontab line and talks straight to Postgres
and Telegram, depending only on `pg` and node.

## 1. Post-deploy smoke gate — `scripts/deploy-smoke-check.sh`

Run it on the box AFTER build + restart. The manual deploy becomes:

```bash
cd /var/www/daromadchi
rm -rf .next && npm ci && npm run build && pm2 restart daromadchi \
  && ./scripts/deploy-smoke-check.sh
```

The `&&` chain is the point: if the gate exits non-zero the sequence stops and you
know immediately, instead of walking away from a broken build. It is **abort-only**
by request — it does not roll back; it fails loudly so you can react.

It probes `/api/health` (which touches no DB/FS and reports `commit` + `uptimeSeconds`)
and asserts three things:

| Check | Catches |
|---|---|
| HTTP 200 within `BOOT_TIMEOUT` (45s) | server never booted — the instrumentation/module failure |
| `commit` == `git rev-parse HEAD` | the new build did not take over (stale process still serving) |
| `uptimeSeconds` small and increasing | the process is crash-looping |

Env overrides: `HEALTH_URL` (default `http://127.0.0.1:3000/api/health` — probe THIS
box's process, not the public URL), `APP_DIR`, `BOOT_TIMEOUT`. It falls back to a
grep/sed JSON extractor when `jq` is absent, so it never fails for its own missing
dependency.

## 2. Sync-freshness watchdog — `scripts/sync-freshness-check.mjs`

Crontab (its own line, every 5 min):

```
*/5 * * * *  /var/www/daromadchi/scripts/sync-freshness-check.sh >> $HOME/daromadchi-cron.log 2>&1
```

The `.sh` wrapper sources the app env (`.env.production.local` → `.env`, same as
cron-runner) and execs plain `node` on the `.mjs`.

**What it watches.** Primary signal: `MAX(shops.stock_synced_at)` across active,
keyed shops — that column advances every ~15 min on every such shop's successful
stock read, plan-independent, whether or not any number changed. Freshest-read
older than the threshold ⇒ sync is not completing ⇒ **alarm**. Context only: newest
`stock_write_log.created_at` — writes are legitimately sparse (the engine writes
only when a listing diverges), so their absence is **not** an alarm; it is printed
in the log line for context.

**Two outputs, by design.**
- Telegram → operators (`TELEGRAM_ADMIN_CHAT_ID`, same fallback id as
  `lib/telegram-admin.ts`): once on the stale edge, at most hourly while stale, once
  on recovery.
- A logfile line **every** run (`FRESHNESS_LOG_FILE`, default
  `logs/sync-freshness.log`). Alerting only through the same Telegram path the app
  uses would go silent exactly when creds or network are the fault; the file trace
  survives that.

De-dup state persists in `FRESHNESS_STATE_FILE` (a tiny JSON file), so a fresh
process each tick still knows whether it already paged.

**Env:** `DATABASE_URL` (required), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`,
`FRESHNESS_STALE_MINUTES` (40), `FRESHNESS_REALERT_MINUTES` (60), `DRY_RUN=1` to
evaluate + log without paging.

**Test it safely on the box:**

```bash
cd /var/www/daromadchi
set -a; . ./.env.production.local 2>/dev/null || . ./.env; set +a
DRY_RUN=1 FRESHNESS_STALE_MINUTES=0 node scripts/sync-freshness-check.mjs   # force a "would page"
DRY_RUN=1 node scripts/sync-freshness-check.mjs                            # real threshold, no page
tail logs/sync-freshness.log
```

Exit code is 0 whether OK or STALE (a fired alarm is a successful run); non-zero
only when the watchdog itself cannot run (no `DATABASE_URL`, DB unreachable) — worth
a crontab `MAILTO`.

The pure decision logic (`scripts/sync-freshness-lib.mjs`) is unit-tested:
`node --test scripts/sync-freshness-lib.test.mjs`.
