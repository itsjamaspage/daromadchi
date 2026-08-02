/**
 * Mock-marketplace integration test. Drives the REAL code — pushStock, the
 * egress guard, retry, the request builders, and the read-back client functions
 * (fetchAllUzumSkuStocks / fetchYandexStockLocations) — against a stateful fake
 * store via a mocked global.fetch. No real credentials, no real network.
 *
 * It is NOT a live-store proof (a genuine live write needs real seller tokens +
 * DB + outbound access). What it proves hermetically:
 *   • the write payloads are exactly right (Uzum skuAmountList+fbsLinked, YM
 *     FIT+updatedAt), reach the store, and the value round-trips on read-back;
 *   • the read-back catches a "silent 200 that changed nothing" — the YM
 *     stale-updatedAt failure mode — as observed !== target.
 *
 * Run: node --import tsx --test lib/marketplace/stock-writer.integration.test.ts
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { pushStock } from './stock-writer'
import { fetchAllUzumSkuStocks } from '../uzum/client'
import { fetchYandexStockLocations } from '../yandex/client'
import { checkMarketplaceRequest } from '../marketplace-readonly-guard'

// ── Stateful fake store + fetch mock ─────────────────────────────────────────
const store = { uzum: new Map<string, number>(), ym: new Map<string, number>() }
let ymDropsWrite = false // models YM silently ignoring a stale-updatedAt write
let lastWrite: { url: string; method: string; body: unknown } | null = null

const realFetch = globalThis.fetch
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}

before(() => {
  // @ts-expect-error override global fetch for the test
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    const path = url.split('?')[0]
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined

    // Uzum stock WRITE
    if (path.endsWith('/v2/fbs/sku/stocks') && method === 'POST') {
      lastWrite = { url, method, body }
      for (const s of body.skuAmountList) store.uzum.set(String(s.barcode), s.amount)
      return json({ status: 'OK' })
    }
    // Uzum stock READ (read-back source)
    if (path.endsWith('/v3/fbs/sku/stocks') && method === 'GET') {
      const skuList = [...store.uzum.entries()].map(([barcode, amount]) => ({ barcode, amount }))
      return json({ payload: { skuList } })
    }
    // YM warehouses READ
    if (path.endsWith('/warehouses') && method === 'GET') {
      return json({ result: { warehouses: [{ id: 987654, name: 'FBS-1' }] } })
    }
    // YM stock WRITE (PUT); when ymDropsWrite, return 200 but DON'T change the store
    if (/\/v2\/campaigns\/\d+\/offers\/stocks$/.test(path) && method === 'PUT') {
      lastWrite = { url, method, body }
      if (!ymDropsWrite) for (const s of body.skus) store.ym.set(String(s.sku), s.items?.[0]?.count ?? 0)
      return json({}) // 200 either way — the "silent success"
    }
    // YM stock READ (POST offers/stocks; read-back source)
    if (path.endsWith('/offers/stocks') && method === 'POST') {
      const offers = [...store.ym.entries()].map(([offerId, count]) => ({ offerId, stocks: [{ type: 'FIT', count }] }))
      return json({ result: { warehouses: [{ warehouseId: 987654, offers }] } })
    }
    return json({ error: 'unhandled', url, method }, 404)
  }
})

after(() => { globalThis.fetch = realFetch })

const uzumShop = { id: 'uz-shop', marketplace: 'uzum' as const, api_key_encrypted: 'PLAINTEXT_TOKEN', shop_id_external: null, api_mode: 'stock_sync' as const }
const ymShop = { id: 'ym-shop', marketplace: 'yandex_market' as const, api_key_encrypted: 'PLAINTEXT_TOKEN', shop_id_external: '149137909', api_mode: 'stock_sync' as const }
const BARCODE = '4780012345678'
const SHOP_SKU = 'JMJ16BEG'

async function readBackUzum(barcode: string): Promise<number | null> {
  const stocks = await fetchAllUzumSkuStocks('PLAINTEXT_TOKEN')
  const rec = stocks.find(s => String(s.barcode) === barcode)
  return rec?.amount ?? null
}
async function readBackYm(sku: string): Promise<number | null> {
  const locs = await fetchYandexStockLocations('PLAINTEXT_TOKEN', '149137909')
  return locs.get(sku)?.count ?? null
}

describe('Uzum live round-trip (real pushStock + read-back)', () => {
  it('push target 0 → 200 → read-back observed === target', async () => {
    store.uzum.set(BARCODE, 1) // listed 1 before the sale
    const res = await pushStock({ shop: uzumShop, sku: SHOP_SKU, barcode: BARCODE, quantity: 0, dryRun: false, version: 1 })
    assert.equal(res.status, 'sent')
    // exact payload the writer built
    assert.deepEqual(lastWrite?.body, { skuAmountList: [{ barcode: BARCODE, amount: 0, fbsLinked: true }] })
    const observed = await readBackUzum(BARCODE)
    assert.equal(observed, 0)      // observed === target
  })

  it('restore to real stock (target 5) → read-back verifies too', async () => {
    const res = await pushStock({ shop: uzumShop, sku: SHOP_SKU, barcode: BARCODE, quantity: 5, dryRun: false, version: 2 })
    assert.equal(res.status, 'sent')
    assert.equal(await readBackUzum(BARCODE), 5)
  })

  it('clamps a negative quantity to 0 on the wire', async () => {
    await pushStock({ shop: uzumShop, sku: SHOP_SKU, barcode: BARCODE, quantity: -3, dryRun: false, version: 3 })
    assert.equal((lastWrite?.body as { skuAmountList: { amount: number }[] }).skuAmountList[0].amount, 0)
  })
})

describe('Yandex Market round-trip + stale-updatedAt detection', () => {
  it('honest store: push 0 → read-back observed === target, payload carries FIT + updatedAt', async () => {
    ymDropsWrite = false
    store.ym.set(SHOP_SKU, 1)
    const res = await pushStock({ shop: ymShop, sku: SHOP_SKU, barcode: null, warehouseId: '987654', quantity: 0, dryRun: false, version: 1, updatedAt: '2026-08-02T10:00:00.000Z' })
    assert.equal(res.status, 'sent')
    const item = (lastWrite?.body as { skus: { warehouseId: number; items: { count: number; type: string; updatedAt: string }[] }[] }).skus[0]
    assert.equal(item.warehouseId, 987654)
    assert.equal(item.items[0].type, 'FIT')
    assert.equal(item.items[0].updatedAt, '2026-08-02T10:00:00.000Z') // moment-of-computation, not now
    assert.equal(await readBackYm(SHOP_SKU), 0)
  })

  it('STALE updatedAt: store returns 200 but ignores the write → read-back catches it (observed !== target)', async () => {
    ymDropsWrite = true            // YM silently drops the write (stale timestamp)
    store.ym.set(SHOP_SKU, 1)      // still listing 1
    const res = await pushStock({ shop: ymShop, sku: SHOP_SKU, barcode: null, warehouseId: '987654', quantity: 0, dryRun: false, version: 2, updatedAt: '2026-08-02T10:00:00.000Z' })
    assert.equal(res.status, 'sent')            // bare HTTP 200 — looks like success
    const observed = await readBackYm(SHOP_SKU)
    assert.equal(observed, 1)                   // store did NOT change
    assert.notEqual(observed, 0)                // read-back is what catches the silent success
  })
})

describe('guard still blocks a price write at the writer boundary', () => {
  it('sendPriceData with stock-write intent is rejected', () => {
    assert.throws(
      () => checkMarketplaceRequest('https://api-seller.uzum.uz/api/seller-openapi/v1/product/1/sendPriceData', 'POST', 'stock-write'),
      /STOCK-WRITE GUARD/,
    )
  })
})
