# Scheduled jobs

Every recurring job runs from the VPS crontab, which calls
`scripts/cron-runner.sh`, which calls an HTTP endpoint. The application code has
always been in git; the schedule that drives it was not, which meant losing the
box would have left a working application that did nothing — no renewals, no
plan expiry, no syncs — with no record of what the cadence had been.

## Status: reconciled 2025-08-27

`scripts/crontab.example` now holds the **real** live cadences (`crontab -l`), not
proposals. It is the source of truth. When you change the live crontab, update it
here in the same commit.

### The source-of-truth fix

The live crontab called `/var/www/daromadchi/cron-runner.sh` — an **untracked copy
at the repo root** that had drifted from `scripts/cron-runner.sh` (it stopped
writing the per-job `logs/` files and used the `digest` job name). Repoint the root
path at the tracked script, one command on the box, so the drift cannot recur:

```bash
ln -sfn scripts/cron-runner.sh /var/www/daromadchi/cron-runner.sh
```

The crontab keeps its historical root path; the symlink makes that path resolve to
the version-controlled script. `digest` is accepted as an alias for
`telegram-digest` in `cron-runner.sh`, so the existing crontab line needs no edit.

### If you ever re-reconcile

```bash
crontab -l > /tmp/crontab.live
diff /tmp/crontab.live /var/www/daromadchi/scripts/crontab.example
```

Where they disagree, **the live file wins** — it is the schedule that has actually
been running the business — so copy its cadences into `crontab.example` and commit,
rather than overwriting the live crontab with this file.

## Monitoring

Deploy smoke gate and the sync-freshness watchdog are documented in
`docs/ops/monitoring.md`. The watchdog runs from its own crontab line (already in
`crontab.example`), not through this runner, because it must survive the app being
down.

## Jobs

| Job | Endpoint | What it does |
|---|---|---|
| `expire-plans` | `/api/billing/expire-plans` | Expires lapsed plans; recomputes derived tiers; sends due price notices; runs free-tier nudges; steps the account-lifecycle ladder |
| `billing-renew` | `/api/cron/billing-renew` | Charges stored cards before expiry. No-op unless `BILLING_AUTORENEW_ENABLED` |
| `sync` | `/api/cron/sync` | Pulls orders and products from both marketplaces |
| `stock-sync` | `/api/cron/stock-sync` | Stock write-back for `stock_sync` shops |
| `telegram-digest` | `/api/cron/telegram-digest` | Per-seller Telegram digests, filtered by each seller's notification window |

`expire-plans` carries most of the week's work. Several sweeps deliberately ride
it rather than adding schedulers of their own — if it stops, price notices,
nudges and the freeze ladder all stop silently with it.

## Running one by hand

```bash
cd /var/www/daromadchi
./scripts/cron-runner.sh --list
./scripts/cron-runner.sh expire-plans
echo $?          # 0 = HTTP 200, 1 = anything else
tail logs/cron-expire-plans.log
```

The script sends the secret as **both** `x-cron-secret` and
`Authorization: Bearer`, because the endpoints disagree about which they read.
That is a wart in the routes; sending both means no job can fail for guessing
wrong. `CRON_SECRET` comes from the environment, falling back to
`.env.production.local` then `.env`, and is never logged.

A missing secret is a hard failure with a non-zero exit, not a skip: a job that
could not authenticate has not run, and a silent skip is indistinguishable from a
job that ran and found nothing to do.

## If the VPS is lost

1. Deploy the app.
2. Set `CRON_SECRET` (and `BILLING_AUTORENEW_ENABLED`,
   `ACCOUNT_LIFECYCLE_DELETE_ENABLED` if they were on — both default OFF, which
   is the safe state to come back up in).
3. `crontab scripts/crontab.example`
4. `./scripts/cron-runner.sh expire-plans` and check the log.

Step 3 is the one that only became possible with this file.
