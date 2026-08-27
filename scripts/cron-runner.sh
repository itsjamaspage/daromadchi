#!/usr/bin/env bash
#
# Daromadchi scheduled jobs.
#
# WHY THIS FILE EXISTS
#
# Every recurring job in the product — renewals, plan expiry, the tier recompute,
# price notices, free-tier nudges, the account-lifecycle sweep, the marketplace
# syncs — is triggered by the VPS crontab calling HTTP endpoints. The code for all
# of it is in git; the schedule that runs it was not. If that box were lost, the
# application would survive intact and do nothing: no renewals, no expiries, no
# syncs, and no way to know what the cadence had been.
#
# This is that schedule, in version control.
#
# ── HOW IT IS USED ─────────────────────────────────────────────────────────────
#
#   ./cron-runner.sh <job>        run one job
#   ./cron-runner.sh --list       print the jobs and their endpoints
#
# One entry point rather than a crontab full of curl invocations, so the base URL,
# the secret, the timeouts and the logging are defined once. Adding a job is a line
# in JOBS below plus a line in crontab.example.
#
# ── AUTH ───────────────────────────────────────────────────────────────────────
#
# The endpoints do not agree on how the secret arrives — some read x-cron-secret,
# others an Authorization: Bearer header. That is a wart in the routes, not here;
# this sends BOTH on every call, which every endpoint accepts, so a job cannot
# fail for having guessed the wrong one.
#
# CRON_SECRET is read from the environment, falling back to the app's own env file.
# It is never written to the log.

set -uo pipefail

APP_DIR="${DAROMADCHI_DIR:-/var/www/daromadchi}"
BASE_URL="${DAROMADCHI_URL:-https://www.daromadchi.uz}"
LOG_DIR="${DAROMADCHI_LOG_DIR:-$APP_DIR/logs}"
# Longer than the routes' own maxDuration (300s) so a slow-but-working run is not
# killed halfway through a marketplace sync.
TIMEOUT="${DAROMADCHI_CRON_TIMEOUT:-600}"

# job name | path
# `digest` is an alias for `telegram-digest`: the live VPS crontab calls `digest`,
# so the tracked script must answer to it or a reinstall from here would break that
# line. Both names hit the same endpoint.
JOBS="
sync|/api/cron/sync
stock-sync|/api/cron/stock-sync
telegram-digest|/api/cron/telegram-digest
digest|/api/cron/telegram-digest
billing-renew|/api/cron/billing-renew
expire-plans|/api/billing/expire-plans
"

usage() {
  echo "usage: $(basename "$0") <job>|--list"
  echo
  echo "jobs:"
  echo "$JOBS" | while IFS='|' read -r name path; do
    [ -n "$name" ] && printf '  %-16s %s\n' "$name" "$path"
  done
}

[ $# -eq 1 ] || { usage; exit 2; }
[ "$1" = "--list" ] && { usage; exit 0; }

JOB="$1"
PATH_FOR_JOB="$(echo "$JOBS" | awk -F'|' -v j="$JOB" '$1==j {print $2}')"
if [ -z "$PATH_FOR_JOB" ]; then
  echo "unknown job: $JOB" >&2
  usage >&2
  exit 2
fi

# Secret: environment first, then the app's env file. Read with a strict match so a
# commented-out or similarly-named variable cannot be picked up by accident.
if [ -z "${CRON_SECRET:-}" ] && [ -f "$APP_DIR/.env.production.local" ]; then
  CRON_SECRET="$(grep -m1 '^CRON_SECRET=' "$APP_DIR/.env.production.local" | cut -d= -f2- | tr -d '"'"'"' \r')"
fi
if [ -z "${CRON_SECRET:-}" ] && [ -f "$APP_DIR/.env" ]; then
  CRON_SECRET="$(grep -m1 '^CRON_SECRET=' "$APP_DIR/.env" | cut -d= -f2- | tr -d '"'"'"' \r')"
fi

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/cron-$JOB.log"
stamp() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

if [ -z "${CRON_SECRET:-}" ]; then
  # Loud, and non-zero: a job that cannot authenticate has not run, and a silent
  # skip here is indistinguishable from a job that did nothing because there was
  # nothing to do.
  echo "$(stamp) $JOB FATAL no CRON_SECRET in env or $APP_DIR/.env*" | tee -a "$LOG_FILE" >&2
  exit 1
fi

START=$(date +%s)
# --max-time bounds the whole request; -sS keeps curl quiet but still reports real
# errors; the body is captured so a 200-with-an-error-payload is visible in the log.
HTTP_BODY=$(curl -sS -X GET \
  --max-time "$TIMEOUT" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -w $'\n%{http_code}' \
  "$BASE_URL$PATH_FOR_JOB" 2>&1)
CURL_RC=$?
ELAPSED=$(( $(date +%s) - START ))

HTTP_CODE=$(printf '%s' "$HTTP_BODY" | tail -n1)
BODY=$(printf '%s' "$HTTP_BODY" | sed '$d')

# Truncated: some of these return a row per user, and an unbounded log fills the
# disk on the one day something goes wrong and every run is verbose.
printf '%s %s rc=%s http=%s %ss %s\n' \
  "$(stamp)" "$JOB" "$CURL_RC" "$HTTP_CODE" "$ELAPSED" "$(printf '%s' "$BODY" | head -c 900 | tr '\n' ' ')" \
  >> "$LOG_FILE"

if [ "$CURL_RC" -ne 0 ] || [ "$HTTP_CODE" != "200" ]; then
  echo "$(stamp) $JOB FAILED rc=$CURL_RC http=$HTTP_CODE" >&2
  exit 1
fi
