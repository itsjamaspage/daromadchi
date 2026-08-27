#!/usr/bin/env bash
#
# Post-deploy smoke gate — fail the deploy instead of leaving a broken build live.
#
# WHY THIS EXISTS
#
# On 2025-08-27 a deploy left the app serving a build whose `.next` referenced a
# Next internal (setup-node-env.external.js) that was absent from the installed
# node_modules — a build/modules skew. `npm run build` had exited 0; the failure
# only appeared at SERVER BOOT, when instrumentation could not load. PM2 reported
# "online" and the process served errors for 30+ minutes.
#
# The lesson: "build exited 0" does not mean "the server boots and serves." The
# only honest check is to BOOT the built output and probe it. /api/health is built
# for exactly this — it touches no DB/FS, and it reports `commit` (BUILD_SHA
# inlined at build) and `uptimeSeconds`, so a probe can prove three things:
#   1. the server answers 200 at all         → it booted (instrumentation loaded)
#   2. commit == the tree we just built       → the new build actually took over
#   3. uptimeSeconds small and increasing     → it is not crash-looping
#
# USAGE (run AFTER `npm run build` and `pm2 restart`, on the box):
#
#   ./scripts/deploy-smoke-check.sh
#     env: HEALTH_URL   default http://127.0.0.1:3000/api/health
#          APP_DIR      default /var/www/daromadchi   (for `git rev-parse HEAD`)
#          BOOT_TIMEOUT default 45   (seconds to wait for the first 200)
#
# Exit 0 = healthy and serving the new build. Non-zero = ABORT: this is
# abort-only by request (manual deploy: rm -rf .next && npm ci && npm run build &&
# pm2 restart), so on failure it does NOT roll back — it tells you loudly and
# non-zero so your deploy sequence (`&&`-chained) stops and you can react.

set -uo pipefail

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
APP_DIR="${APP_DIR:-${DAROMADCHI_DIR:-/var/www/daromadchi}}"
BOOT_TIMEOUT="${BOOT_TIMEOUT:-45}"

fail() { echo "SMOKE FAIL: $*" >&2; exit 1; }

# jq is the clean path; fall back to a grep/sed extractor so the gate does not
# itself depend on jq being installed on the box.
json_field() { # <json> <field>
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$1" | jq -r --arg f "$2" '.[$f] // empty'
  else
    printf '%s' "$1" | grep -o "\"$2\"[[:space:]]*:[[:space:]]*\"\{0,1\}[^,\"}]*" | head -n1 | sed "s/.*:[[:space:]]*\"\{0,1\}//"
  fi
}

expected_sha=""
if git -C "$APP_DIR" rev-parse HEAD >/dev/null 2>&1; then
  expected_sha="$(git -C "$APP_DIR" rev-parse HEAD)"
else
  echo "SMOKE WARN: cannot read HEAD in $APP_DIR — skipping the commit-match check" >&2
fi

# 1) Wait for the first 200. A booting server (or a crash loop) yields non-200 or
#    connection-refused; we poll until BOOT_TIMEOUT before declaring failure.
echo "smoke: probing $HEALTH_URL (up to ${BOOT_TIMEOUT}s for boot)…"
deadline=$(( $(date +%s) + BOOT_TIMEOUT ))
body=""
code=""
while :; do
  body="$(curl -sS --max-time 5 -w $'\n%{http_code}' "$HEALTH_URL" 2>/dev/null)" || body=""
  code="$(printf '%s' "$body" | tail -n1)"
  body="$(printf '%s' "$body" | sed '$d')"
  [ "$code" = "200" ] && break
  [ "$(date +%s)" -ge "$deadline" ] && fail "no HTTP 200 from health within ${BOOT_TIMEOUT}s (last code=${code:-none}). Server did not boot — check the instrumentation/module error in the pm2 log."
  sleep 2
done

served_commit="$(json_field "$body" commit)"
uptime1="$(json_field "$body" uptimeSeconds)"
echo "smoke: 200 OK, commit=${served_commit:-unknown} uptime=${uptime1:-?}s"

# 2) The running process must be serving the commit we just built. Different =>
#    the build did not take over (stale process), the failure mode /api/health
#    was written to expose.
if [ -n "$expected_sha" ]; then
  [ -n "$served_commit" ] || fail "health did not report a commit — cannot confirm the new build took over."
  [ "$served_commit" = "$expected_sha" ] || fail "serving commit $served_commit but the deployed tree is $expected_sha — the new build did not take over (stale process)."
  echo "smoke: commit matches deployed HEAD."
fi

# 3) Not crash-looping: uptime must be a small positive number that GROWS across a
#    short wait. A value that resets to near-zero is PM2 recycling a dying process.
if [ -n "${uptime1//[!0-9]/}" ]; then
  sleep 6
  body2="$(curl -sS --max-time 5 -w $'\n%{http_code}' "$HEALTH_URL" 2>/dev/null)" || body2=""
  code2="$(printf '%s' "$body2" | tail -n1)"
  body2="$(printf '%s' "$body2" | sed '$d')"
  [ "$code2" = "200" ] || fail "health stopped answering on the second probe (code=${code2:-none}) — the process is unstable."
  uptime2="$(json_field "$body2" uptimeSeconds)"
  if [ -n "${uptime2//[!0-9]/}" ] && [ "$uptime2" -le "$uptime1" ]; then
    fail "uptime did not increase (${uptime1}s → ${uptime2}s) — the process is crash-looping."
  fi
  echo "smoke: process stable (uptime ${uptime1}s → ${uptime2}s)."
fi

echo "SMOKE OK: new build is live and serving."
