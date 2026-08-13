/**
 * ATMOS hosted-checkout MANUAL sandbox test (Phase 1).
 *
 * Self-contained (mirrors lib/billing/atmos.ts) so it runs directly on the VPS
 * where the ATMOS creds live and apigw.atmos.uz is reachable — the CI sandbox
 * cannot reach ATMOS. NO card data touches this script; the card is entered on
 * ATMOS's hosted page.
 *
 * Usage (from repo root, with .env loaded into the environment):
 *   node scripts/atmos-manual-test.mjs                # create a 50 000 UZS invoice, print the checkout URL
 *   node scripts/atmos-manual-test.mjs --amount 5000000   # amount in TIYIN
 *   node scripts/atmos-manual-test.mjs --status <atmos_payment_id>  # re-query status
 *
 * Sandbox test card: PAN 9860090101014364, expiry 02/28, OTP 111111 (Uzcard/Humo).
 */

import { readFileSync, existsSync } from 'node:fs'

// Minimal .env loader (only if the vars aren't already in the environment).
function loadEnv() {
  for (const f of ['.env.local', '.env', '.env.production.local', '.env.production']) {
    if (!existsSync(f)) continue
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}
loadEnv()

const BASE = (process.env.ATMOS_BASE_URL || 'https://apigw.atmos.uz').replace(/\/$/, '')
const need = (n) => {
  const v = process.env[n]
  if (!v) { console.error(`missing env ${n}`); process.exit(1) }
  return v
}

async function getToken() {
  const basic = Buffer.from(`${need('ATMOS_CONSUMER_KEY')}:${need('ATMOS_CONSUMER_SECRET')}`).toString('base64')
  const res = await fetch(`${BASE}/token?grant_type=client_credentials`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: 'grant_type=client_credentials',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.access_token) { console.error(`token failed HTTP ${res.status}`, json); process.exit(1) }
  return json.access_token
}

async function authedPost(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

const args = process.argv.slice(2)
const statusIdx = args.indexOf('--status')
const amountIdx = args.indexOf('--amount')
const amountTiyin = amountIdx >= 0 ? Number(args[amountIdx + 1]) : 5_000_000  // 50 000 UZS

const token = await getToken()
console.log('✓ token acquired (value not printed)')

if (statusIdx >= 0) {
  const paymentId = args[statusIdx + 1]
  const { status, json } = await authedPost('/checkout/invoice/get', { payment_id: paymentId }, token)
  console.log(`\ninvoice/get HTTP ${status}:`)
  console.log(JSON.stringify(json, null, 2))
  process.exit(0)
}

const requestId = crypto.randomUUID()
const account = crypto.randomUUID()
const body = {
  request_id: requestId,
  store_id: Number(need('ATMOS_STORE_ID')),
  account,
  amount: amountTiyin,
  success_url: process.env.ATMOS_SUCCESS_URL || 'https://daromadchi.uz/billing/atmos/return',
  items: [{
    items_id: '1',
    code: need('ATMOS_SERVICE_IKPU'),
    name: 'Daromadchi — подписка (Pro, 1 мес) [MANUAL TEST]',
    amount: amountTiyin,
    quantity: 1,
    details: [{ name: 'quantity', values: '1' }],
  }],
}

const { status, json } = await authedPost('/checkout/invoice/create', body, token)
console.log(`\ninvoice/create HTTP ${status}:`)
console.log(JSON.stringify(json, null, 2))

const url = json?.url || json?.checkout_url || json?.payment_url
const paymentId = json?.payment_id || json?.paymentId
console.log('\n──────────────────────────────────────────────────────────────')
console.log(`request_id : ${requestId}`)
console.log(`account    : ${account}`)
console.log(`payment_id : ${paymentId ?? '(not found — inspect response above)'}`)
console.log(`amount     : ${amountTiyin} tiyin (${amountTiyin / 100} UZS)`)
console.log(`checkout   : ${url ?? '(no url — inspect response above)'}`)
console.log('──────────────────────────────────────────────────────────────')
console.log(`
NEXT STEPS (manual):
  1. Open the checkout URL in a browser.
  2. Confirm Uzcard/Humo is selectable on the hosted page.
  3. Pay with test card PAN 9860090101014364, expiry 02/28, OTP 111111.
  4. You are redirected to ATMOS_SUCCESS_URL (/billing/atmos/return) — it re-queries
     status and shows SUCCESS.
  5. Re-query here:  node scripts/atmos-manual-test.mjs --status ${paymentId ?? '<payment_id>'}
  6. In the app DB, the payment row (account=${account}) should be atmos_status='success'
     exactly once; a duplicate callback for it is a no-op (re-ack {status:1}).
`)
