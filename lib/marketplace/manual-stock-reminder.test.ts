/**
 * Manual stock reminders for read-only shops — pure logic, plus the guardrail.
 *
 * Run: node --conditions=react-server --import tsx --test lib/marketplace/manual-stock-reminder.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  planManualStockFixes, buildManualStockMessage, selectUnnotified, dedupKeyFor,
  type ManualStockGroup,
} from './manual-stock-reminder'
import type { SyncMember } from './stock-allocation'

function member(over: Partial<SyncMember> & Pick<SyncMember, 'marketplace' | 'apiMode' | 'listedStock'>): SyncMember {
  return {
    productId: `p-${over.marketplace}`,
    shopId: `s-${over.marketplace}`,
    priority: 0,
    physicalStock: null,
    pending: 0,
    sku: 'JMWHT',
    ...over,
  }
}

/** The brief's worked example: Uzum sold the last unit, Yandex still shows 1. */
function soldLastUnit(yandexMode: 'read_only' | 'stock_sync' = 'read_only'): ManualStockGroup {
  return {
    matchKey: 'JMWHT',
    title: 'Jempir oq',
    members: [
      member({ marketplace: 'uzum', apiMode: 'read_only', listedStock: 1, physicalStock: 1, pending: 1 }),
      member({ marketplace: 'yandex_market', apiMode: yandexMode, listedStock: 1, physicalStock: 1 }),
    ],
  }
}

describe('planManualStockFixes', () => {
  it('names the exact number to set on the read-only listing', () => {
    const fixes = planManualStockFixes([soldLastUnit()])
    // available = max(physical) 1 − pending 1 = 0. Uzum already shows 1 with the
    // order against it, Yandex still advertises 1 it cannot fulfil.
    assert.equal(fixes.length, 2)
    const yandex = fixes.find(f => f.marketplace === 'yandex_market')!
    assert.equal(yandex.target, 0)
    assert.equal(yandex.listed, 1)
    assert.equal(yandex.sku, 'JMWHT')
  })

  it('leaves stock_sync members alone — those get written for', () => {
    const fixes = planManualStockFixes([soldLastUnit('stock_sync')])
    assert.deepEqual(fixes.map(f => f.marketplace), ['uzum'])
  })

  it('says nothing about a listing that is already correct', () => {
    const fixes = planManualStockFixes([{
      matchKey: 'JMWHT', title: null,
      members: [
        member({ marketplace: 'uzum', apiMode: 'read_only', listedStock: 3, physicalStock: 3 }),
        member({ marketplace: 'yandex_market', apiMode: 'read_only', listedStock: 3, physicalStock: 3 }),
      ],
    }])
    assert.deepEqual(fixes, [])
  })

  it('ignores a single-marketplace group — nothing to reconcile against', () => {
    // One listing IS the truth for itself; "set it to N" would be telling the
    // seller to change a number we derived from that same number.
    const fixes = planManualStockFixes([{
      matchKey: 'SOLO', title: null,
      members: [member({ marketplace: 'uzum', apiMode: 'read_only', listedStock: 7, physicalStock: 2 })],
    }])
    assert.deepEqual(fixes, [])
  })

  it('mirrors the same target to every read-only member (mirror-always)', () => {
    const fixes = planManualStockFixes([{
      matchKey: 'JMWHT', title: null,
      members: [
        member({ marketplace: 'uzum', apiMode: 'read_only', listedStock: 5, physicalStock: 4 }),
        member({ marketplace: 'yandex_market', apiMode: 'read_only', listedStock: 0, physicalStock: 4 }),
      ],
    }])
    // No lock-last-unit or partition split: both are told the real free-to-sell.
    assert.deepEqual(fixes.map(f => f.target), [4, 4])
  })

  it('never advises a negative number', () => {
    const fixes = planManualStockFixes([{
      matchKey: 'JMWHT', title: null,
      members: [
        member({ marketplace: 'uzum', apiMode: 'read_only', listedStock: 1, physicalStock: 1, pending: 9 }),
        member({ marketplace: 'yandex_market', apiMode: 'read_only', listedStock: 2, physicalStock: 1 }),
      ],
    }])
    assert.ok(fixes.every(f => f.target >= 0), 'a negative target would be un-settable')
  })
})

describe('selectUnnotified — dedup on the advised number', () => {
  const fixes = planManualStockFixes([soldLastUnit()])
  const yandex = fixes.find(f => f.marketplace === 'yandex_market')!

  it('sends when nothing has been advised before', () => {
    assert.equal(selectUnnotified([yandex], new Map()).length, 1)
  })

  it('stays quiet while the advised number is unchanged', () => {
    const prior = new Map([[`${dedupKeyFor('JMWHT')}|yandex_market`, 0]])
    assert.deepEqual(selectUnnotified([yandex], prior), [])
  })

  it('speaks again when a new sale moves the number', () => {
    const prior = new Map([[`${dedupKeyFor('JMWHT')}|yandex_market`, 3]])
    assert.equal(selectUnnotified([yandex], prior).length, 1)
  })

  it('keys separately from the write digest, which shares the table', () => {
    // stock_notify_state is keyed (user, sku, marketplace). Without the prefix a
    // manual reminder and a write digest for the same SKU+store would overwrite
    // each other's state and each would silence the other.
    assert.notEqual(dedupKeyFor('JMWHT'), 'JMWHT')
    assert.ok(dedupKeyFor('JMWHT').includes('JMWHT'))
  })
})

describe('buildManualStockMessage', () => {
  const fixes = planManualStockFixes([soldLastUnit()])

  for (const lang of ['ru', 'uz', 'en'] as const) {
    it(`renders in ${lang} with no undefined and the real number`, () => {
      const msg = buildManualStockMessage(fixes, lang)
      assert.doesNotMatch(msg, /undefined/)
      assert.match(msg, /JMWHT/)
      assert.match(msg, /Yandex Market/)
      assert.match(msg, /<b>0<\/b>/)
    })
  }

  it('ru and uz differ — no hardcoded literal leaking across languages', () => {
    assert.notEqual(buildManualStockMessage(fixes, 'ru'), buildManualStockMessage(fixes, 'uz'))
  })
})
