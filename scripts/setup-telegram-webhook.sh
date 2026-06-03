#!/usr/bin/env bash
# One-time Telegram webhook registration for the Daromadchi alerts bot.
#
# Usage (run from a machine that can reach api.telegram.org):
#   export TELEGRAM_BOT_TOKEN='8901419245:AAF...'        # from @BotFather
#   export TELEGRAM_WEBHOOK_SECRET='some-random-string'  # optional, must match the app env var
#   export APP_URL='https://daromadchi.uz'               # your production URL
#   bash scripts/setup-telegram-webhook.sh
#
# The token is read from the environment and never written to the repo.

set -euo pipefail

: "${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN}"
APP_URL="${APP_URL:-https://daromadchi.uz}"
WEBHOOK_URL="${APP_URL%/}/api/telegram/webhook"

echo "Bot identity:"
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | sed 's/,/,\n  /g'
echo

echo "Registering webhook -> ${WEBHOOK_URL}"
SECRET_ARG=""
if [ -n "${TELEGRAM_WEBHOOK_SECRET:-}" ]; then
  SECRET_ARG="&secret_token=${TELEGRAM_WEBHOOK_SECRET}"
fi

curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}&allowed_updates=%5B%22message%22%2C%22callback_query%22%5D${SECRET_ARG}"
echo
echo
echo "Current webhook status:"
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | sed 's/,/,\n  /g'
echo
