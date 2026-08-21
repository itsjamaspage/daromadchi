/**
 * How long does Daromadchi take to reflect a stock change made on the
 * marketplace? This answers that with measurements, not estimates.
 *
 * READ-ONLY, end to end. No DB writes, no marketplace writes, no change to
 * sync behaviour. The two live calls are the cheap stock-only reads the
 * clients already make — Uzum GET /v3/fbs/sku/stocks and Yandex
 * POST /v2/campaigns/{id}/offers/stocks, the latter already allowlisted in
 * lib/marketplace-readonly-guard.ts as a read that requires POST.
 *
 *   set -a; . ./.env; set +a
 *   npm run measure:stock-latency -- KBWHT
 *   npm run measure:stock-latency -- --watch KBWHT
 *
 * Watch mode polls the DB (not the marketplace) every 60s and prints the
 * wall-clock moment Daromadchi's stored value changes, so you can edit stock
 * on the marketplace, start the watch, and time the pickup exactly. Capped at
 * 30 minutes so it cannot run away.
 *
 * ── One caveat this tool cannot fix ─────────────────────────────────────────
 * It measures latency honestly. If a SKU is stuck for a REASON rather than a
 * delay — a value the sync keeps rewriting to the same wrong number — the watch
 * will simply never report a change. That is a finding, not a hang.
 */
import { and, eq, ilike, or } from 'drizzle-orm'
import { db, shops, products, users } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { fetchAllUzumSkuStocks } from '@/lib/uzum/client'
import { fetchYandexStocks } from '@/lib/yandex/client'

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Same table the cron uses. Kept in sync by eye; see app/api/cron/sync/route.ts. */
const SYNC_INTERVAL_MS: Record<string, number> = {
  free: 6 * 60 * 60 * 1000,
  pro: 2 * 60 * 60 * 1000,
  pro_plus: 30 * 60 * 1000,
}

const WATCH_POLL_MS = 60_000
const WATCH_MAX_MS = 30 * 60 * 1000

const args = process.argv.slice(2)
const watch = args.includes('--watch')
// Several terms are accepted on purpose: the same product carries a different
// SKU on each marketplace (KBWHT on Uzum, KY-БЕЛЫЙ on Yandex), so one term
// would answer for only half the stores. A shared word from the title works
// for both.
const terms = args.filter(a => !a.startsWith('--'))
const skuArg = terms.join(' ')

const ago = (d: Date | null): string => {
  if (!d) return 'never'
  const m = Math.round((Date.now() - d.getTime()) / 60000)
  return m < 60 ? `${m} min ago` : `${(m / 60).toFixed(1)} h ago`
}
const inFuture = (ms: number): string =>
  ms <= 0 ? 'due now' : ms < 3600_000 ? `in ~${Math.round(ms / 60000)} min` : `in ~${(ms / 3600_000).toFixed(1)} h`

const pad = (s: unknown, n: number) => String(s ?? '').padEnd(n)

async function loadShops() {
  // Plan comes from the owning user — the same input the cron's interval
  // table keys on — so the "next refresh" figure matches what actually gates.
  return db.select({
    id: shops.id, marketplace: shops.marketplace, name: shops.name,
    externalId: shops.shop_id_external, enc: shops.api_key_encrypted,
    lastSyncedAt: shops.last_synced_at, plan: users.plan,
  }).from(shops).innerJoin(users, eq(users.id, shops.user_id))
    .where(eq(shops.is_active, true))
}

/** Stored rows for the SKU. Matches loosely — marketplace SKUs differ per store. */
async function storedRows(searchTerms: string[]) {
  if (searchTerms.length === 0) return []
  const match = searchTerms.flatMap(t => [ilike(products.sku, `%${t}%`), ilike(products.title, `%${t}%`)])
  return db.select({
    sku: products.sku, title: products.title, stock: products.stock_quantity,
    physical: products.physical_stock, updatedAt: products.updated_at,
    marketplace: shops.marketplace, shopId: shops.id, lastSyncedAt: shops.last_synced_at,
  }).from(products).innerJoin(shops, eq(shops.id, products.shop_id))
    .where(and(eq(shops.is_active, true), or(...match)))
}

/** Live Uzum quantity per SKU code. One paged GET; ~1–2 calls for a small shop. */
async function liveUzum(token: string): Promise<{ map: Map<string, number>; calls: number }> {
  const rows = await fetchAllUzumSkuStocks(token)
  const map = new Map<string, number>()
  for (const r of rows as any[]) {
    const qty = Number(r.amount ?? r.quantityActive ?? 0)
    for (const k of [r.sellerSkuCode, r.sellerItemCode, r.sellerSku, r.article, r.sku, r.barcode]) {
      if (k) map.set(String(k).toLowerCase(), qty)
    }
  }
  return { map, calls: Math.max(1, Math.ceil(rows.length / 50)) }
}

/**
 * Live Yandex quantity per offer — AND the bucket types behind it.
 *
 * The types matter as much as the number: the sync counts only the FIT bucket,
 * so an offer whose units sit in another bucket reads 0 here while the seller's
 * cabinet shows stock. Printing the raw types is what distinguishes "genuinely
 * sold out" from "counted the wrong bucket".
 */
async function liveYandex(token: string, campaignId: string, skus: string[]) {
  const map = new Map<string, { fit: number; buckets: string }>()
  let calls = 0
  if (skus.length === 0) return { map, calls }
  const res: any = await fetchYandexStocks(token, campaignId, skus)
  calls++
  const take = (key: string, stocks: any[] | undefined) => {
    if (!key) return
    const list = stocks ?? []
    const fit = list.find(s => s?.type === 'FIT')?.count ?? 0
    const buckets = list.length === 0 ? '(none)' : list.map(s => `${s?.type}=${s?.count}`).join(' ')
    const prev = map.get(key.toLowerCase())
    map.set(key.toLowerCase(), { fit: (prev?.fit ?? 0) + Number(fit || 0), buckets })
  }
  for (const item of res?.result?.skus ?? []) take(item.sku ?? item.offerId ?? '', item.warehouseStocks ?? item.stocks)
  for (const w of res?.result?.warehouses ?? []) for (const off of w.offers ?? []) take(off.offerId ?? '', off.stocks)
  return { map, calls }
}

async function report() {
  const all = await loadShops()
  if (all.length === 0) { console.log('No active shops.'); return }

  console.log('\n══ Sync cadence ══')
  for (const s of all) {
    const plan = s.plan ?? 'free'
    const interval = SYNC_INTERVAL_MS[plan] ?? SYNC_INTERVAL_MS.free
    const next = s.lastSyncedAt ? interval - (Date.now() - new Date(s.lastSyncedAt).getTime()) : 0
    console.log(`  ${pad(s.marketplace, 15)} plan=${pad(plan, 9)} last stock refresh: ${pad(ago(s.lastSyncedAt), 14)} next: ${inFuture(next)}`)
  }
  console.log('  NOTE: last_synced_at only advances on a HEAVY pass — that is the stock refresh,')
  console.log('        not the 5-min order poll.')

  if (terms.length === 0) {
    console.log('\nPass one or more terms for the drift check:')
    console.log('  npm run measure:stock-latency -- KBWHT KY-БЕЛЫЙ     (per-marketplace SKUs)')
    console.log('  npm run measure:stock-latency -- GTX350             (a word both titles share)\n')
    return
  }

  const rows = await storedRows(terms)
  if (rows.length === 0) { console.log(`\nNo stored product matches ${JSON.stringify(terms)}.\n`); return }

  let calls = 0
  const failures: string[] = []
  const uzLive = new Map<string, number>()
  const ymLive = new Map<string, { fit: number; buckets: string }>()
  for (const s of all) {
    if (!s.enc) continue
    const token = decrypt(s.enc)
    try {
      if (s.marketplace === 'uzum') {
        const r = await liveUzum(token); calls += r.calls
        for (const [k, v] of r.map) uzLive.set(k, v)
      } else if (s.marketplace === 'yandex_market' && s.externalId) {
        const skus = rows.filter(r => r.marketplace === 'yandex_market').map(r => r.sku!).filter(Boolean)
        const r = await liveYandex(token, s.externalId, skus); calls += r.calls
        for (const [k, v] of r.map) ymLive.set(k, v)
      }
    } catch (e) {
      // A failed call still spent rate-limit budget, and reporting 0 would read
      // as "nothing was tried" — which is the opposite of what happened.
      calls++
      failures.push(`${s.marketplace}: ${String(e).slice(0, 140)}`)
    }
  }

  console.log('\n══ Drift: what Daromadchi has vs what the marketplace has NOW ══')
  console.log(`  ${pad('SKU', 22)}${pad('marketplace', 15)}${pad('daromadchi', 12)}${pad('live now', 10)}${pad('match', 7)}last sync`)
  for (const r of rows) {
    const key = (r.sku ?? '').toLowerCase()
    const live = r.marketplace === 'uzum' ? uzLive.get(key) : ymLive.get(key)?.fit
    const shown = live === undefined ? '—' : String(live)
    const match = live === undefined ? '?' : (Number(live) === Number(r.stock) ? 'yes' : 'NO')
    console.log(`  ${pad(r.sku, 22)}${pad(r.marketplace, 15)}${pad(r.stock, 12)}${pad(shown, 10)}${pad(match, 7)}${ago(r.lastSyncedAt)}`)
    const yb = r.marketplace === 'yandex_market' ? ymLive.get(key)?.buckets : undefined
    // Only FIT is counted by the sync — show every bucket so a miscount is visible.
    if (yb) console.log(`  ${' '.repeat(22)}buckets: ${yb}`)
  }
  if (failures.length > 0) {
    console.log('\n  Live fetch failed — "live now" is unknown, not zero:')
    for (const f of failures) console.log(`    ! ${f}`)
  }
  console.log(`\n  API calls used: ${calls} (stock-only reads, including failed attempts)`)
  console.log('  updated_at is an INSERT stamp — no sync path writes it, so it is not staleness.\n')
}

async function watchSku() {
  if (terms.length === 0) { console.log('--watch needs at least one SKU or title term.'); return }
  const start = Date.now()
  const seen = new Map<string, number>()
  for (const r of await storedRows(terms)) seen.set(`${r.marketplace}:${r.sku}`, Number(r.stock))
  console.log(`\nWatching "${skuArg}" every ${WATCH_POLL_MS / 1000}s, max ${WATCH_MAX_MS / 60000} min.`)
  console.log('Baseline: ' + [...seen].map(([k, v]) => `${k}=${v}`).join('  '))
  console.log('Polling the DB only — no marketplace calls, no rate-limit cost.\n')
  while (Date.now() - start < WATCH_MAX_MS) {
    await new Promise(r => setTimeout(r, WATCH_POLL_MS))
    for (const r of await storedRows(terms)) {
      const k = `${r.marketplace}:${r.sku}`
      const prev = seen.get(k)
      if (prev !== undefined && Number(r.stock) !== prev) {
        const mins = ((Date.now() - start) / 60000).toFixed(1)
        console.log(`[${new Date().toISOString()}] ${k}: ${prev} → ${r.stock}   (+${mins} min after watch start)`)
        seen.set(k, Number(r.stock))
      }
    }
  }
  console.log(`\nWatch ended after ${WATCH_MAX_MS / 60000} min. No further changes recorded.`)
  console.log('If nothing changed, the value is not merely lagging — check the drift table above.\n')
}

async function main() {
  await report()
  if (watch) await watchSku()
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
