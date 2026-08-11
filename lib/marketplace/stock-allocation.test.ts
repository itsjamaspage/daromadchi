// Pure oversell/allocation logic — the worked JMJ16BEG example and edge cases.
// Run: node --import tsx --test lib/marketplace/stock-allocation.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeAvailable, planStockWrites, type SyncMember } from './stock-allocation'

function member(over: Partial<SyncMember>): SyncMember {
  return {
    productId: over.productId ?? 'p',
    shopId: over.shopId ?? 's',
    marketplace: over.marketplace ?? 'uzum',
    apiMode: over.apiMode ?? 'stock_sync',
    priority: over.priority ?? 100,
    listedStock: over.listedStock ?? 0,
    pending: over.pending ?? 0,
    sku: over.sku ?? 'JMJ16BEG',
  }
}

// The worked example: JMJ16BEG on Uzum (listed 1) + YM (listed 1), one Uzum sale.
const uzum = (o: Partial<SyncMember> = {}) => member({ shopId: 'uzum-shop', marketplace: 'uzum', priority: 0, listedStock: 1, ...o })
const ym = (o: Partial<SyncMember> = {}) => member({ shopId: 'ym-shop', marketplace: 'yandex_market', priority: 100, listedStock: 1, ...o })

describe('computeAvailable', () => {
  it('MAX(stock) − SUM(pending), clamped at 0', () => {
    assert.equal(computeAvailable([uzum({ listedStock: 1, pending: 1 }), ym({ listedStock: 1, pending: 0 })]), 0)
    assert.equal(computeAvailable([uzum({ listedStock: 3, pending: 1 }), ym({ listedStock: 3 })]), 2)
    assert.equal(computeAvailable([uzum({ listedStock: 2, pending: 1 }), ym({ listedStock: 2 })]), 1)
    assert.equal(computeAvailable([uzum({ listedStock: 0, pending: 5 })]), 0)
  })
})

describe('lock_last_unit', () => {
  it('one Uzum sale drives available to 0 → 0 pushed to BOTH stores (two real writes)', () => {
    const { available, plans } = planStockWrites([uzum({ pending: 1 }), ym({ pending: 0 })], 'lock_last_unit')
    assert.equal(available, 0)
    assert.equal(plans.length, 2)
    for (const p of plans) {
      assert.equal(p.target, 0)
      assert.equal(p.willWrite, true) // both listed 1, target 0 → diff
    }
  })

  it('available === 1 → primary (Uzum) gets 1, the other gets 0', () => {
    // MAX 2, pending 1 → available 1
    const { available, plans } = planStockWrites([uzum({ listedStock: 2, pending: 1 }), ym({ listedStock: 2 })], 'lock_last_unit')
    assert.equal(available, 1)
    const byShop = Object.fromEntries(plans.map(p => [p.member.shopId, p.target]))
    assert.equal(byShop['uzum-shop'], 1)
    assert.equal(byShop['ym-shop'], 0)
  })

  it('available >= 2 → available pushed to all', () => {
    const { available, plans } = planStockWrites([uzum({ listedStock: 5, pending: 1 }), ym({ listedStock: 5 })], 'lock_last_unit')
    assert.equal(available, 4)
    for (const p of plans) assert.equal(p.target, 4)
  })

  it('primary follows priority, not marketplace, when YM is set primary', () => {
    const { plans } = planStockWrites(
      [uzum({ listedStock: 2, pending: 1, priority: 100 }), ym({ listedStock: 2, priority: 0 })],
      'lock_last_unit',
    )
    const byShop = Object.fromEntries(plans.map(p => [p.member.shopId, p.target]))
    assert.equal(byShop['ym-shop'], 1)   // YM is primary here
    assert.equal(byShop['uzum-shop'], 0)
  })
})

describe('partition', () => {
  it('splits so the sum never exceeds available, remainder to higher priority', () => {
    const { available, plans } = planStockWrites([uzum({ listedStock: 5, pending: 0 }), ym({ listedStock: 5 })], 'partition')
    assert.equal(available, 5)
    const total = plans.reduce((s, p) => s + p.target, 0)
    assert.ok(total <= available)
    assert.equal(total, 5)
    const byShop = Object.fromEntries(plans.map(p => [p.member.shopId, p.target]))
    assert.equal(byShop['uzum-shop'], 3) // ceil — higher priority
    assert.equal(byShop['ym-shop'], 2)
  })
})

describe('off', () => {
  it('pushes the available quantity to every channel', () => {
    const { available, plans } = planStockWrites([uzum({ listedStock: 5, pending: 2 }), ym({ listedStock: 5 })], 'off')
    assert.equal(available, 3)
    for (const p of plans) assert.equal(p.target, 3)
  })
})

describe('off (mirror-always) — no backstop, mirror available to every channel', () => {
  it('mirrors available to a member WITH an open reserving order (target=available, NOT clamped)', () => {
    // Uzum listed 3 with 1 reserving order; YM listed 5, no order.
    // MAX 5 − pending 1 = available 4. In 'off' the reserve backstop is SKIPPED,
    // so Uzum re-raises 3→4 to mirror the pool even though it holds a reserve.
    // (This is exactly what lets Yandex re-raise 0→1 to match Uzum.)
    const { available, plans } = planStockWrites(
      [uzum({ listedStock: 3, pending: 1 }), ym({ listedStock: 5, pending: 0 })],
      'off',
    )
    assert.equal(available, 4)
    const byShop = Object.fromEntries(plans.map(p => [p.member.shopId, p.target]))
    assert.equal(byShop['uzum-shop'], 4)   // MIRRORED — raised 3→4 despite the open order
    assert.equal(byShop['ym-shop'], 4)
  })
})

describe('backstop guard (lock_last_unit / partition only) — never raise a listing with an open order', () => {
  it('holds a listing with an open reserving order instead of raising it', () => {
    // Same inputs as above but under lock_last_unit: available 4 (>=2) would push
    // 4 to both, RAISING Uzum 3→4 and un-reserving its committed unit. The backstop
    // (still active in non-off modes) clamps Uzum to hold at 3.
    const { available, plans } = planStockWrites(
      [uzum({ listedStock: 3, pending: 1 }), ym({ listedStock: 5, pending: 0 })],
      'lock_last_unit',
    )
    assert.equal(available, 4)
    const byShop = Object.fromEntries(plans.map(p => [p.member.shopId, p.target]))
    assert.equal(byShop['uzum-shop'], 3)   // held, NOT raised to 4 (open order)
    assert.equal(byShop['ym-shop'], 4)     // lowered 5→4, allowed
  })

  it('still allows a legitimate restock increase when there is no open order', () => {
    // Uzum listed 3, NO reserving order; YM listed 5. available 5 → Uzum may
    // rise 3→5 (a real restock, nothing committed against it).
    const { available, plans } = planStockWrites(
      [uzum({ listedStock: 3, pending: 0 }), ym({ listedStock: 5, pending: 0 })],
      'lock_last_unit',
    )
    assert.equal(available, 5)
    const uzumPlan = plans.find(p => p.member.shopId === 'uzum-shop')!
    assert.equal(uzumPlan.target, 5)       // raised — restock allowed
    assert.equal(uzumPlan.willWrite, true)
  })
})

describe('real-diff-only + read-only members', () => {
  it('no write when the listed number already equals the target', () => {
    // available 2, both already listing 2 → no writes
    const { plans } = planStockWrites([uzum({ listedStock: 2, pending: 0 }), ym({ listedStock: 2 })], 'lock_last_unit')
    for (const p of plans) assert.equal(p.willWrite, false)
  })

  it('read-only members feed available but are never planned for a write', () => {
    const { available, plans } = planStockWrites(
      [uzum({ apiMode: 'stock_sync', listedStock: 3, pending: 1 }), ym({ apiMode: 'read_only', listedStock: 3 })],
      'off',
    )
    assert.equal(available, 2)
    assert.equal(plans.length, 1)              // only the stock_sync Uzum member
    assert.equal(plans[0].member.shopId, 'uzum-shop')
  })
})
