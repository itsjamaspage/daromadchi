#!/usr/bin/env bash
#
# Crontab entry point for the sync-freshness watchdog.
#
# The watchdog (scripts/sync-freshness-check.mjs) needs DATABASE_URL and the
# Telegram env, which live in the app's env file. This sources them the same way
# cron-runner.sh sources CRON_SECRET — env first, then .env.production.local, then
# .env — and hands off to plain `node`. No tsx: the watchdog depends only on `pg`
# and global fetch so it survives a broken app build, and pulling tsx in would
# undo that.
#
# Crontab line (every 5 min, its OWN line — NOT via cron-runner.sh, which is
# HTTP-only and therefore dead exactly when the alarm is needed):
#
#   */5 * * * *  /var/www/daromadchi/scripts/sync-freshness-check.sh >> $HOME/daromadchi-cron.log 2>&1

set -uo pipefail

APP_DIR="${DAROMADCHI_DIR:-/var/www/daromadchi}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load the app env (values already in the environment win). Never printed.
load_env() {
  local f="$1"
  [ -f "$f" ] || return 0
  set -a
  # shellcheck disable=SC1090
  . "$f"
  set +a
}
if [ -z "${DATABASE_URL:-}" ]; then load_env "$APP_DIR/.env.production.local"; fi
if [ -z "${DATABASE_URL:-}" ]; then load_env "$APP_DIR/.env"; fi

export DAROMADCHI_DIR

# One run per pass. cron was firing this ~3× within 30ms (a duplicated crontab
# line), which would page in triplicate. flock -n lets exactly ONE instance hold
# the lock; a concurrent duplicate can't acquire it. `-E 0` makes that clean skip
# exit 0 (not an error mail), while a real failure from the node script still
# passes through as its own non-zero. If flock isn't installed, fall back — the
# script's own debounce still collapses a staggered repeat.
LOCK="${DAROMADCHI_LOG_DIR:-$APP_DIR/logs}/.sync-freshness.lock"
mkdir -p "$(dirname "$LOCK")" 2>/dev/null || true
if command -v flock >/dev/null 2>&1; then
  exec flock -n -E 0 "$LOCK" node "$SCRIPT_DIR/sync-freshness-check.mjs"
else
  exec node "$SCRIPT_DIR/sync-freshness-check.mjs"
fi
