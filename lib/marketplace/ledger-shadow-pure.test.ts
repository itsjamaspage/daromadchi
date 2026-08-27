// Pure shadow-evaluator shaping. Run:
//   node --import tsx --test lib/marketplace/ledger-shadow-pure.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { toGroupOrders, comparisonRows, type RawGroupOrder, type ShadowMember } from './ledger-shadow-pure'

const raw = (o: Partial<RawGroupOrder>): RawGroupOrder => ({
  orderIdExternal: 'o1', marketplace: 'yandex_market', qty: 1,
  rawStatus: 'PROCESSING', normalizedStatus: 'pending', ...o,
})

describe('toGroupOrders — RESERVING-anchored mapping', () => {
  it('a paid/committed raw status → live (consumes)', () => {
    assert.deepEqual(toGroupOrders([raw({ rawStatus: 'PROCESSING' })]),
      [{ orderIdExternal: 'o1', marketplace: 'yandex_market', qty: 1, status: 'live' }])
    assert.equal(toGroupOrders([raw({ rawStatus: 'PACKING', marketplace: 'uzum' })])[0].status, 'live')
  })
  it('an unpaid draft → dropped (null status, never competes)', () => {
    assert.deepEqual(toGroupOrders([raw({ rawStatus: 'CREATED', normalizedStatus: 'pending' })]), [])
    assert.deepEqual(toGroupOrders([raw({ rawStatus: 'UNPAID', normalizedStatus: 'pending' })]), [])
  })
  it('cancelled / returned map by normalized status; returned defaults restockable=false', () => {
    assert.equal(toGroupOrders([raw({ normalizedStatus: 'cancelled', rawStatus: null })])[0].status, 'cancelled')
    const ret = toGroupOrders([raw({ normalizedStatus: 'returned', rawStatus: null })])[0]
    assert.equal(ret.status, 'returned')
    assert.equal(ret.restockable, false)   // under-credit by design (undersell-safe)
  })
  it('delivered → delivered (live-CLOSED): kept, never re-consumed', () => {
    assert.equal(toGroupOrders([raw({ normalizedStatus: 'delivered', rawStatus: null })])[0].status, 'delivered')
  })
})

describe('comparisonRows — PER ROW, not per group (the JMBLK proof)', () => {
  it('emits one row per member carrying that member\'s OWN physical_stock', () => {
    // JMBLK: uzum physical 1 (corrupted), yandex physical 2. Group MAX = 2, so
    // legacyAvailable hides the uzum corruption; per-row keeps it visible.
    const members: ShadowMember[] = [
      { marketplace: 'uzum', sku: 'JMBLK', physicalStock: 1 },
      { marketplace: 'yandex_market', sku: 'JMBLK', physicalStock: 2 },
    ]
    const rows = comparisonRows('jmblk', members, /*legacyAvailable*/ 2, /*ledgerOnHand*/ 2, /*seeded*/ true)
    assert.equal(rows.length, 2)                       // one PER listing
    assert.equal(rows[0].legacyPhysicalStock, 1)       // uzum's own corrupted value
    assert.equal(rows[1].legacyPhysicalStock, 2)       // yandex's own value
    // Group figures repeat; the per-row physical is what exposes the drift.
    assert.deepEqual(rows.map(r => r.legacyAvailable), [2, 2])
    assert.deepEqual(rows.map(r => r.ledgerOnHand), [2, 2])
  })
  it('diff is SUPPRESSED (null) when unseeded — the −pool value carries no signal', () => {
    const m: ShadowMember[] = [{ marketplace: 'uzum', sku: 'KBBLK', physicalStock: 2 }]
    const unseeded = comparisonRows('kbblk', m, 2, 0, /*seeded*/ false)[0]
    assert.equal(unseeded.seeded, false)
    assert.equal(unseeded.diff, null)                  // not printed / not readable pre-seed
    assert.equal(unseeded.ledgerOnHand, 0)             // raw components still present
    assert.equal(unseeded.legacyAvailable, 2)
  })
  it('diff = ledgerOnHand − legacyAvailable ONLY once seeded', () => {
    const m: ShadowMember[] = [{ marketplace: 'uzum', sku: 'KBBLK', physicalStock: 2 }]
    assert.equal(comparisonRows('kbblk', m, 2, 2, true)[0].diff, 0)     // agree
    assert.equal(comparisonRows('kbblk', m, 2, 1, true)[0].diff, -1)    // ledger 1 unit low
  })
})
