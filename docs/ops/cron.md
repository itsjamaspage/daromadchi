# Scheduled jobs

Every recurring job runs from the VPS crontab, which calls
`scripts/cron-runner.sh`, which calls an HTTP endpoint. The application code has
always been in git; the schedule that drives it was not, which meant losing the
box would have left a working application that did nothing — no renewals, no
plan expiry, no syncs — with no record of what the cadence had been.

## The one thing to do first

`scripts/crontab.example` is **not** a copy of the live crontab. It could not be:
the live schedule was never committed, so it cannot be recovered from this
repository. Only `expire-plans` (`15 3 * * *`) is known-correct, from
`docs/plans/turnover-pricing-spec.md`. Everything else is a proposal derived from
what the code implies.

**Reconcile before installing anything:**

```bash
ssh <vps>
crontab -l > /tmp/crontab.live
diff /tmp/crontab.live /var/www/daromadchi/scripts/crontab.example
```

Where they disagree, **the live file wins** — it is the schedule that has actually
been running the business. Copy its real cadences into `crontab.example`, commit
that, and only then consider installing. Overwriting the live crontab with the
proposals would silently change how often sellers' data syncs and when their
cards are charged.

Once `crontab.example` matches reality, this file stops being a reconstruction
and becomes the source of truth.

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
