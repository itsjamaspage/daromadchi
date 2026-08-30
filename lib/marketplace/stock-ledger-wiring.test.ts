/**
 * Stock-ledger Part 1 — the pure wiring logic. No DB.
 * Run: node --import tsx --test lib/marketplace/stock-ledger-wiring.test.ts
 *
 * The centrepiece is the exact production incident: a sold-out SKU whose sibling
 * listing still shows a stale 1 (our own last write). The legacy MAX path writes
 * that phantom 1 to the zeroed listing; the ledger path must compute 0 and write 0.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { planStockWrites, computeAvailable, type SyncMember } from './stock-allocation.ts'
import {
  seedGrossOnHand, driftCredit, sellerListingAvailable, availableFromOnHand,
  ledgerOnHand, diffLedger, type GroupOrder, type LedgerEvent,
} from './stock-ledger.ts'

const member = (o: Partial<SyncMember>): SyncMember => ({
  productId: o.productId ?? 'p', shopId: o.shopId ?? 's', marketplace: o.marketplace ?? 'uzum',
  apiMode: 'stock_sync', priority: o.priority ?? 0, listedStock: o.listedStock ?? 0,
  physicalStock: o.physicalStock ?? null, pending: o.pending ?? 0, sku: o.sku ?? 'PBGRY',
})

describe('the 0→1 incident: sold-out SKU, sibling listing stale-high at our own write', () => {
  // Real stock 0. Uzum listing 0. Yandex listing still shows 1 — the «через API»
  // value the seller saw — and that 1 is OUR OWN last write. No open orders.
  const uzum   = member({ shopId: 'u', marketplace: 'uzum',          listedStock: 0, physicalStock: 0 })
  const yandex = member({ shopId: 'y', marketplace: 'yandex_market', listedStock: 1, physicalStock: 1 })
  const members = [uzum, yandex]

  it('LEGACY MAX path writes the phantom 1 — this is the bug', () => {
    const { available, plans } = planStockWrites(members, 'off')      // no onHand → MAX path
    assert.equal(available, 1)                                        // MAX(0,1) − 0
    assert.ok(plans.some(p => p.target === 1), 'legacy writes 1 to the zeroed listing')
  })

  it('LEDGER path computes 0 and writes 0, not 1', () => {
    const onHand = 0                                                  // Σ ledger delta: seed 0, no consume
    // Drift must NOT re-inflate: the stale 1 is our own last write → excluded.
    const listingAvail = sellerListingAvailable([
      { listedStock: 0, pending: 0, lastWrite: 0 },                   // Uzum: our write 0
      { listedStock: 1, pending: 0, lastWrite: 1 },                   // Yandex: our stale write 1 → excluded
    ])
    const drift = driftCredit(listingAvail, availableFromOnHand(onHand))
    assert.equal(drift, 0, 'a stale own-write listing must never credit the pool')

    const { available, plans } = planStockWrites(members, 'off', onHand + drift)
    assert.equal(available, 0, 'available = max(0, on_hand) = 0')
    assert.deepEqual(plans.map(p => p.target).sort(), [0, 0])
    assert.ok(!plans.some(p => p.target > 0), 'no phantom write reaches a marketplace')
  })
})

describe('cancel credit (§10.1)', () => {
  it('cancel returns stock to 10, not 9', () => {
    // True shelf seeded at 10, one open order of 1 consumed → on_hand 9.
    const seeded: LedgerEvent[] = [
      { delta: 10, reason: 'seed', orderIdExternal: null },
      { delta: -1, reason: 'consume', orderIdExternal: 'O1' },
    ]
    assert.equal(ledgerOnHand(seeded), 9)
    // The order cancels → diffLedger releases the consumed unit (+1).
    const orders: GroupOrder[] = [{ orderIdExternal: 'O1', marketplace: 'uzum', qty: 1, status: 'cancelled' }]
    const writes = diffLedger(orders, new Set(['consume:O1']))
    assert.deepEqual(writes.map(w => ({ d: w.delta, r: w.reason })), [{ d: 1, r: 'cancel' }])
    const after = ledgerOnHand([...seeded, ...writes.map(w => ({ delta: w.delta, reason: w.reason, orderIdExternal: w.orderIdExternal }))])
    assert.equal(after, 10)
  })
})

describe('seed value (§3.2, §10.2)', () => {
  it('baseline is preferred over the listing', () => {
    assert.equal(seedGrossOnHand(10, 8, 1), 10)
  })

  it('no baseline → free-to-sell + open reserving units (gross shelf)', () => {
    assert.equal(seedGrossOnHand(null, 9, 1), 10)
  })

  it('seeding with an open order nets to free-to-sell, not free-to-sell − qty', () => {
    // Shelf 10, one open unit. free-to-sell = computeAvailable = 9.
    const members = [member({ marketplace: 'uzum', listedStock: 10, physicalStock: 10, pending: 1 })]
    const freeToSell = computeAvailable(members)
    assert.equal(freeToSell, 9)
    const gross = seedGrossOnHand(null, freeToSell, 1)                // 10
    const onHand = ledgerOnHand([
      { delta: gross, reason: 'seed', orderIdExternal: null },
      { delta: -1, reason: 'consume', orderIdExternal: 'O1' },
    ])
    assert.equal(onHand, 9)
  })
})

describe('restock adoption (§5, §12.1)', () => {
  it('adopts a genuine seller restock (increase)', () => {
    // Seller raised Uzum 0→5; not our write; no reserved. Ledger available 0.
    const listingAvail = sellerListingAvailable([{ listedStock: 5, pending: 0, lastWrite: 0 }])
    assert.equal(listingAvail, 5)
    assert.equal(driftCredit(listingAvail, 0), 5)
  })

  it('compares AVAILABLE not FIT — reserved is netted out', () => {
    // Yandex FIT read 1 = 0 available + 1 reserved. Not a restock.
    assert.equal(sellerListingAvailable([{ listedStock: 1, pending: 1, lastWrite: null }]), 0)
  })

  it('a stale listing equal to our own write is never seller evidence', () => {
    assert.equal(sellerListingAvailable([{ listedStock: 1, pending: 0, lastWrite: 1 }]), 0)
  })

  it('ignores a drop — increases only, the undersell-safe direction', () => {
    assert.equal(driftCredit(0, 5), 0)
  })
})
