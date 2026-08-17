/**
 * ATMOS DIRECT card-binding MANUAL test (the working path — replaces the broken
 * hosted invoice). Self-contained (mirrors lib/billing/atmos.ts) so it runs on the
 * VPS where the ATMOS creds live and apigw.atmos.uz is reachable.
 *
 * Runs: bind-card/init → (you type the SMS OTP) → bind-card/confirm → pay/create →
 * pay/pre-apply → pay/apply. Amounts in TIYIN; expiry "YYmm"; token apply OTP is the
 * literal "111111". NOTHING is stored — this only proves the ATMOS calls succeed.
 *
 * Usage (repo root, .env loaded):
 *   node scripts/atmos-direct-test.mjs
 *   node scripts/atmos-direct-test.mjs --card 5614688715378807 --expiry 03/29 --amount 5000000
 *
 * Sandbox test card (store 11054): 5614688715378807, exp 03/29, OTP 111111.
 */

import { readFileSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { randomUUID } from 'node:crypto'

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
const need = (n) => { const v = process.env[n]; if (!v) { console.error(`missing env ${n}`); process.exit(1) } return v }
const arg = (name, def) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def }

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

async function post(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  const code = json?.result?.code
  const ok = res.ok && (!code || String(code).toUpperCase() === 'OK')
  console.log(`  ${path} → HTTP ${res.status}  result.code=${code ?? '(none)'}`)
  if (!ok) { console.error('  ✗ FAILED:', JSON.stringify(json?.result ?? json, null, 2)); process.exit(1) }
  return json ?? {}
}

const pick = (o, keys) => { for (const k of keys) { const s = o?.[k] ?? o?.result?.[k] ?? o?.data?.[k]; if (s != null && s !== '') return String(s) } return undefined }

const card = arg('--card', '5614688715378807').replace(/\s/g, '')
const expiryRaw = arg('--expiry', '03/29')
const digits = expiryRaw.replace(/\D/g, '')
const expiryYYmm = `${digits.slice(-2)}${digits.slice(0, 2)}`   // "03/29" → "2903"
const amountTiyin = Number(arg('--amount', '5000000'))          // 50 000 UZS
const account = randomUUID()

const token = await getToken()
console.log('✓ token acquired (value not printed)\n')

console.log(`1. bind-card/init  card ****${card.slice(-4)}  expiry ${expiryYYmm}`)
const init = await post('/partner/bind-card/init', { card_number: card, expiry: expiryYYmm }, token)
const bindTxn = pick(init, ['transaction_id', 'transactionId'])
if (!bindTxn) { console.error('no bind transaction_id'); process.exit(1) }
console.log(`   bind txn: ${bindTxn}  (SMS OTP sent to the card's phone)\n`)

const rl = createInterface({ input, output })
const otp = (await rl.question('   Enter the SMS OTP (sandbox: 111111): ')).trim()
rl.close()

console.log('\n2. bind-card/confirm')
const conf = await post('/partner/bind-card/confirm', { transaction_id: bindTxn, otp }, token)
const cardToken = pick(conf, ['card_token', 'cardToken', 'token'])
if (!cardToken) { console.error('no card_token'); process.exit(1) }
console.log(`   card bound ✓  masked=${pick(conf, ['pan', 'card_number', 'masked_pan']) ?? '?'}  (token value not printed)\n`)

console.log(`3. pay/create  amount ${amountTiyin} tiyin  account ${account}`)
const created = await post('/merchant/pay/create', { amount: amountTiyin, account, store_id: Number(need('ATMOS_STORE_ID')) }, token)
const payTxn = pick(created, ['transaction_id', 'transactionId'])
if (!payTxn) { console.error('no pay transaction_id'); process.exit(1) }
console.log(`   pay txn: ${payTxn}\n`)

console.log('4. pay/pre-apply')
await post('/merchant/pay/pre-apply', { transaction_id: payTxn, card_token: cardToken, store_id: Number(need('ATMOS_STORE_ID')) }, token)

console.log('\n5. pay/apply  (token OTP literal "111111")')
await post('/merchant/pay/apply', { transaction_id: payTxn, otp: '111111', store_id: Number(need('ATMOS_STORE_ID')) }, token)

console.log('\n✅ Direct charge succeeded end-to-end. This is the flow the app now uses.')
