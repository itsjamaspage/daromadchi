// Load-bearing guard test. Proves the marketplace egress guard's decision
// logic: read stays read, the ONE sanctioned stock write gets through, and
// everything else — including the wrong method on the right path — is rejected.
//
// Run:  node --import tsx --test lib/marketplace-readonly-guard.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { checkMarketplaceRequest } from './marketplace-readonly-guard'

// Same physical path; POST = YM read, PUT = YM write.
const YM_STOCKS = 'https://api.partner.market.yandex.ru/v2/campaigns/149137909/offers/stocks'
const YM_STOCKS_Q = `${YM_STOCKS}?limit=200`
const YM_OFFER_MAPPINGS = 'https://api.partner.market.yandex.ru/v2/businesses/555/offer-mappings'
const YM_OFFER_CARDS = 'https://api.partner.market.yandex.ru/v2/businesses/555/offer-cards?limit=200'

const UZUM_STOCK_WRITE = 'https://api-seller.uzum.uz/api/seller-openapi/v2/fbs/sku/stocks'
const UZUM_SEND_PRICE = 'https://api-seller.uzum.uz/api/seller-openapi/v1/product/12345/sendPriceData'
const UZUM_ORDER_CANCEL = 'https://api-seller.uzum.uz/api/seller-openapi/v1/fbs/order/98765/cancel'
const UZUM_ORDER_CONFIRM = 'https://api-seller.uzum.uz/api/seller-openapi/v1/fbs/order/98765/confirm'
const UZUM_ORDER_REFUND = 'https://api-seller.uzum.uz/api/seller-openapi/v1/fbs/order/98765/refund'
const UZUM_SHOPS_GET = 'https://api-seller.uzum.uz/api/seller-openapi/v1/shops'
const YM_ORDER_STATUS = 'https://api.partner.market.yandex.ru/v2/campaigns/149137909/orders/555/status'

describe('marketplace egress guard — read intent (default)', () => {
  it('allows plain GET reads', () => {
    assert.doesNotThrow(() => checkMarketplaceRequest(UZUM_SHOPS_GET, 'GET', 'read'))
    assert.doesNotThrow(() => checkMarketplaceRequest(UZUM_SHOPS_GET, 'GET'))
  })

  it('allows an allowlisted read-POST (YM offer-mappings, YM offers/stocks read)', () => {
    assert.doesNotThrow(() => checkMarketplaceRequest(YM_OFFER_MAPPINGS, 'POST', 'read'))
    assert.doesNotThrow(() => checkMarketplaceRequest(YM_STOCKS, 'POST', 'read'))
    assert.doesNotThrow(() => checkMarketplaceRequest(YM_STOCKS_Q, 'POST', 'read'))
  })

  it('allows the YM offer-cards read-POST (colour attribute source, incl. query string)', () => {
    assert.doesNotThrow(() => checkMarketplaceRequest(YM_OFFER_CARDS, 'POST', 'read'))
    // …but only as a READ. offer-cards must never be reachable with write intent.
    assert.throws(() => checkMarketplaceRequest(YM_OFFER_CARDS, 'PUT', 'stock-write'), /STOCK-WRITE GUARD/)
  })

  it('rejects a non-allowlisted POST (Uzum stock-WRITE path is not a read)', () => {
    assert.throws(() => checkMarketplaceRequest(UZUM_STOCK_WRITE, 'POST', 'read'), /READONLY GUARD/)
  })

  it('rejects PUT / PATCH / DELETE regardless of URL', () => {
    assert.throws(() => checkMarketplaceRequest(YM_STOCKS, 'PUT', 'read'), /READONLY GUARD/)
    assert.throws(() => checkMarketplaceRequest(UZUM_STOCK_WRITE, 'DELETE'), /READONLY GUARD/)
    assert.throws(() => checkMarketplaceRequest(UZUM_SEND_PRICE, 'PATCH', 'read'), /READONLY GUARD/)
  })
})

describe('marketplace egress guard — stock-write intent', () => {
  it('allows the exact Uzum stock write (POST /v2/fbs/sku/stocks)', () => {
    assert.doesNotThrow(() => checkMarketplaceRequest(UZUM_STOCK_WRITE, 'POST', 'stock-write'))
  })

  it('allows the exact YM stock write (PUT …/offers/stocks)', () => {
    assert.doesNotThrow(() => checkMarketplaceRequest(YM_STOCKS, 'PUT', 'stock-write'))
  })

  // The same-path/different-method case — the subtle hole the owner flagged.
  it('BLOCKS POST on the YM offers/stocks path even with write intent (write is PUT only)', () => {
    assert.throws(() => checkMarketplaceRequest(YM_STOCKS, 'POST', 'stock-write'), /STOCK-WRITE GUARD/)
  })

  it('BLOCKS PUT on the Uzum stock path (Uzum write is POST only)', () => {
    assert.throws(() => checkMarketplaceRequest(UZUM_STOCK_WRITE, 'PUT', 'stock-write'), /STOCK-WRITE GUARD/)
  })

  it('BLOCKS a price change (sendPriceData) with write intent', () => {
    assert.throws(() => checkMarketplaceRequest(UZUM_SEND_PRICE, 'POST', 'stock-write'), /STOCK-WRITE GUARD/)
  })

  it('BLOCKS an order-cancel URL with write intent', () => {
    assert.throws(() => checkMarketplaceRequest(UZUM_ORDER_CANCEL, 'POST', 'stock-write'), /STOCK-WRITE GUARD/)
  })

  it('BLOCKS a read endpoint reached with write intent (offer-mappings)', () => {
    assert.throws(() => checkMarketplaceRequest(YM_OFFER_MAPPINGS, 'POST', 'stock-write'), /STOCK-WRITE GUARD/)
  })

  it('BLOCKS the stock path with a trailing query string (exact-URL only)', () => {
    assert.throws(() => checkMarketplaceRequest(YM_STOCKS_Q, 'PUT', 'stock-write'), /STOCK-WRITE GUARD/)
  })

  it('BLOCKS the order-cancel endpoint reached with STOCK-write intent (separate allowlists)', () => {
    assert.throws(() => checkMarketplaceRequest(UZUM_ORDER_CANCEL, 'POST', 'stock-write'), /STOCK-WRITE GUARD/)
  })
})

describe('marketplace egress guard — order-cancel intent (cancel-ONLY)', () => {
  it('allows the exact Uzum order-cancel (POST …/fbs/order/{id}/cancel)', () => {
    assert.doesNotThrow(() => checkMarketplaceRequest(UZUM_ORDER_CANCEL, 'POST', 'order-cancel'))
  })

  it('allows the YM status endpoint ONLY when the body is a cancellation', () => {
    assert.doesNotThrow(() => checkMarketplaceRequest(
      YM_ORDER_STATUS, 'PUT', 'order-cancel',
      JSON.stringify({ order: { status: 'CANCELLED', substatus: 'SHOP_FAILED' } }),
    ))
  })

  // The load-bearing "exactly one hole" proof: the cancel path cannot confirm,
  // process, refund, or otherwise mutate an order.
  it('BLOCKS the YM status endpoint when the body confirms/advances the order', () => {
    assert.throws(() => checkMarketplaceRequest(
      YM_ORDER_STATUS, 'PUT', 'order-cancel',
      JSON.stringify({ order: { status: 'PROCESSING' } }),
    ), /ORDER-CANCEL GUARD/)
  })

  it('BLOCKS the YM status endpoint with no body / a body missing CANCELLED', () => {
    assert.throws(() => checkMarketplaceRequest(YM_ORDER_STATUS, 'PUT', 'order-cancel'), /ORDER-CANCEL GUARD/)
    assert.throws(() => checkMarketplaceRequest(
      YM_ORDER_STATUS, 'PUT', 'order-cancel', JSON.stringify({ order: { substatus: 'X' } }),
    ), /ORDER-CANCEL GUARD/)
  })

  it('BLOCKS a Uzum order CONFIRM with cancel intent (confirm is a different URL)', () => {
    assert.throws(() => checkMarketplaceRequest(UZUM_ORDER_CONFIRM, 'POST', 'order-cancel'), /ORDER-CANCEL GUARD/)
  })

  it('BLOCKS a Uzum order REFUND with cancel intent', () => {
    assert.throws(() => checkMarketplaceRequest(UZUM_ORDER_REFUND, 'POST', 'order-cancel'), /ORDER-CANCEL GUARD/)
  })

  it('BLOCKS a stock-write endpoint reached with CANCEL intent (separate allowlists)', () => {
    assert.throws(() => checkMarketplaceRequest(UZUM_STOCK_WRITE, 'POST', 'order-cancel'), /ORDER-CANCEL GUARD/)
    assert.throws(() => checkMarketplaceRequest(YM_STOCKS, 'PUT', 'order-cancel'), /ORDER-CANCEL GUARD/)
  })
})

/**
 * No raw fetch() may reach a marketplace host.
 *
 * AGENTS.md makes read-only the top constraint of this repository, and
 * marketplaceFetch is what enforces it — but a plain `fetch()` is invisible to
 * it. Three calls sat outside the guard: the Uzum and Yandex token checks in the
 * sync routes, and Uzum's public catalogue lookup in the extension endpoint.
 *
 * All three were GETs, so nothing was ever violated. The gap was structural:
 * nothing stopped a later edit adding `method: 'PUT'` to a call the guard could
 * not see. "Every marketplace call is accounted for" is only worth saying if it
 * is true of all of them.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const REPO = join(import.meta.dirname, '..')

/** Hostnames that belong to a marketplace, in whatever form they appear. */
const MARKETPLACE_HOSTS = [
  'api-seller.uzum.uz',
  'api.uzum.uz',
  'api.partner.market.yandex.ru',
  'UZUM_PUBLIC',        // the constant the extension route builds its URL from
]

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.next', '.git', 'dist', 'build', 'coverage', 'extension'].includes(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

describe('the guard sees every marketplace call', () => {
  it('no raw fetch() reaches a marketplace host', () => {
    const offenders: string[] = []

    for (const file of sourceFiles(REPO)) {
      const rel = relative(REPO, file).replaceAll('\\', '/')
      // The guard itself performs the only sanctioned fetch.
      if (rel === 'lib/marketplace-readonly-guard.ts') continue
      const src = readFileSync(file, 'utf8')
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1')

      // `fetch(` not preceded by `marketplace` (marketplaceFetch) — then check
      // whether the call's first argument names a marketplace host.
      for (const m of code.matchAll(/(?<![A-Za-z])fetch\s*\(([^)]{0,200})/g)) {
        const before = code.slice(Math.max(0, m.index - 20), m.index)
        if (/marketplace$/i.test(before.trim())) continue     // marketplaceFetch(
        const arg = m[1]
        if (MARKETPLACE_HOSTS.some(h => arg.includes(h))) {
          offenders.push(`${rel}:${code.slice(0, m.index).split('\n').length}`)
        }
      }
    }

    assert.deepEqual(offenders, [],
      'route it through marketplaceFetch() — a raw fetch is invisible to the\n' +
      'read-only guard, so nothing stops the next edit turning it into a write:\n\n' +
      offenders.map(o => '  ' + o).join('\n') + '\n')
  })
})
