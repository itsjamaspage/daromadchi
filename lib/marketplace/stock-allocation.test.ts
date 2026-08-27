// Pure oversell/allocation logic — the worked JMJ16BEG example and edge cases.
// Run: node --import tsx --test lib/marketplace/stock-allocation.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeAvailable, rawGroupAvailable, planStockWrites, planGroupWrites, stockWriteBack, detectNewOrders, physicalStockFromRead, shouldAdoptPhysicalStock, decidePush, NON_CONVERGENCE_LIMIT, RESERVING_RAW_STATUSES, type SyncMember, type PlannedWrite, type PushHistory } from './stock-allocation'

function member(over: Partial<SyncMember>): SyncMember {
  return {
    productId: over.productId ?? 'p',
    shopId: over.shopId ?? 's',
    marketplace: over.marketplace ?? 'uzum',
    apiMode: over.apiMode ?? 'stock_sync',
    priority: over.priority ?? 100,
    listedStock: over.listedStock ?? 0,
    // Default NULL → computeAvailable seeds from listedStock, preserving the
    // pre-physical_stock behaviour every existing test relies on.
    physicalStock: over.physicalStock ?? null,
    pending: over.pending ?? 0,
    sku: over.sku ?? 'JMJ16BEG',
  }
}

// The worked example: JMJ16BEG on Uzum (listed 1) + YM (listed 1), one Uzum sale.
const uzum = (o: Partial<SyncMember> = {}) => member({ shopId: 'uzum-shop', marketplace: 'uzum', priority: 0, listedStock: 1, ...o })
const ym = (o: Partial<SyncMember> = {}) => member({ shopId: 'ym-shop', marketplace: 'yandex_market', priority: 100, listedStock: 1, ...o })

describe('rawGroupAvailable — oversell detection reads the PHYSICAL pool, not the listing', () => {
  it('the false-alarm case (KBWHT): last unit sold, both listings mirrored to 0, order still pending → 0, NOT −1', () => {
    // Reproduces the reported bug. A real unit existed (physical 1 on each), it
    // sold on Uzum, the listing was driven to 0 on BOTH marketplaces (sale +
    // mirror), and the order is still counted as pending. The pool is physical=1,
    // so raw = MAX(1,1) − 1 = 0 → NO oversell. The old listing-based math read
    // MAX(0,0) − 1 = −1 and fired a false "Товар закончился … выполнить нечем".
    const members = [
      uzum({ listedStock: 0, physicalStock: 1, pending: 1 }),
      ym({ listedStock: 0, physicalStock: 1, pending: 0 }),
    ]
    assert.equal(rawGroupAvailable(members), 0)          // fixed: not negative
    assert.equal(rawGroupAvailable(members) < 0, false)  // → no oversell alert
    // Prove the OLD listing-based computation would have false-alarmed:
    const oldListingBased = Math.max(0, Math.max(0, 0, 0)) - 1
    assert.equal(oldListingBased, -1)
  })

  it('a GENUINE oversell still fires: one physical unit, two committed orders → −1', () => {
    const members = [
      uzum({ listedStock: 0, physicalStock: 1, pending: 1 }),
      ym({ listedStock: 0, physicalStock: 1, pending: 1 }),   // second order on the sibling
    ]
    // MAX(physical 1,1) − (1+1) = −1 → oversell (the seller genuinely oversold).
    assert.equal(rawGroupAvailable(members), -1)
    assert.equal(rawGroupAvailable(members) < 0, true)
  })

  it('computeAvailable is exactly rawGroupAvailable clamped at 0', () => {
    const sold = [uzum({ listedStock: 0, physicalStock: 1, pending: 1 }), ym({ listedStock: 0, physicalStock: 1 })]
    assert.equal(rawGroupAvailable(sold), 0)
    assert.equal(computeAvailable(sold), 0)
    const over = [uzum({ physicalStock: 1, pending: 2 }), ym({ physicalStock: 1 })]
    assert.equal(rawGroupAvailable(over), -1)
    assert.equal(computeAvailable(over), 0)   // clamped
  })
})

describe('computeAvailable — ledger mode (Option A on_hand override)', () => {
  it('THE JMBLK fix: both pools stale at 2, ledger on_hand=1 → available 1 (NOT MAX(2,2)=2)', () => {
    const members = [uzum({ physicalStock: 2, listedStock: 2, pending: 0 }), ym({ physicalStock: 2, listedStock: 2, pending: 0 })]
    assert.equal(computeAvailable(members, 1), 1)   // the sold unit is finally visible
    assert.equal(computeAvailable(members, 0), 0)
    assert.equal(computeAvailable(members, -3), 0)  // never negative
  })
  it('ignores pending in ledger mode — the debit already happened at placement', () => {
    const members = [uzum({ physicalStock: 2, pending: 1 }), ym({ physicalStock: 2, pending: 1 })]
    assert.equal(computeAvailable(members, 2), 2)   // pending NOT re-subtracted (would be double-count)
  })
  it('falls back to the legacy MAX path when on_hand is null/undefined', () => {
    const members = [uzum({ physicalStock: 2, pending: 0 }), ym({ physicalStock: 2, pending: 1 })]
    assert.equal(computeAvailable(members), 1)          // MAX(2,2)-1, unchanged
    assert.equal(computeAvailable(members, null), 1)    // explicit null = fallback
    assert.equal(computeAvailable(members, undefined), 1)
  })
  it('planStockWrites threads on_hand through to available', () => {
    const members = [uzum({ physicalStock: 2, listedStock: 2 }), ym({ physicalStock: 2, listedStock: 2 })]
    assert.equal(planStockWrites(members, 'off', 1).available, 1)
    assert.equal(planStockWrites(members, 'off').available, 2)   // no on_hand → legacy MAX
  })
})

describe('RESERVING_RAW_STATUSES — Yandex PICKUP reserves a unit', () => {
  // Mirror the SQL's status→pending mapping: reservingOrderCondition() counts an
  // order only when its raw marketplace_status is in this set.
  const reserving = (status: string) => (RESERVING_RAW_STATUSES as readonly string[]).includes(status)

  it('PICKUP reserves (ordered, waiting at the pickup point); DELIVERED does not', () => {
    assert.ok(reserving('PICKUP'))        // committed unit → draws down
    assert.ok(reserving('DELIVERY'))      // still reserving alongside PICKUP
    assert.ok(!reserving('DELIVERED'))    // collected → already in listed stock
  })

  it("an order at marketplace_status='PICKUP' counts as pending=1 and reduces available by 1", () => {
    const pending = ['PICKUP'].filter(reserving).length
    assert.equal(pending, 1)
    // Physical pool 2, one PICKUP order reserving → available 1 (down from 2).
    const withPickup = [
      uzum({ physicalStock: 2, listedStock: 2, pending: 0 }),
      ym({ physicalStock: 2, listedStock: 2, pending }),
    ]
    assert.equal(computeAvailable(withPickup), 1)
    // Same group with no reserving order stays at 2 — proving PICKUP is what drew it down.
    const noOrder = [uzum({ physicalStock: 2, pending: 0 }), ym({ physicalStock: 2, pending: 0 })]
    assert.equal(computeAvailable(noOrder), 2)
  })
})

describe('RESERVING_RAW_STATUSES — reserve at PAYMENT, not at unpaid draft', () => {
  // Mirror the SQL's status→pending mapping: reservingOrderCondition() counts an
  // order only when its raw marketplace_status is in this set.
  const reserving = (status: string) => (RESERVING_RAW_STATUSES as readonly string[]).includes(status)

  it('Uzum: paid/committed states reserve (PACKING onward); unpaid draft does NOT', () => {
    // Paid & committed — the seller is fulfilling an accepted, prepaid order.
    for (const s of ['PACKING', 'PENDING_DELIVERY', 'DELIVERING', 'ACCEPTED_AT_DP']) {
      assert.ok(reserving(s), `${s} should reserve (paid/committed)`)
    }
    // Freshly placed / unpaid draft — Uzum auto-cancels these constantly; they
    // must NOT reserve or they'd phantom-out the sibling listing.
    for (const s of ['CREATED', 'NEW', 'PENDING']) {
      assert.ok(!reserving(s), `${s} must NOT reserve (unpaid draft)`)
    }
  })

  it('Yandex: PROCESSING (paid) reserves; UNPAID/PLACING/RESERVED do NOT', () => {
    for (const s of ['PROCESSING', 'DELIVERY', 'PICKUP']) {
      assert.ok(reserving(s), `${s} should reserve (paid/committed)`)
    }
    for (const s of ['UNPAID', 'PLACING', 'RESERVED']) {
      assert.ok(!reserving(s), `${s} must NOT reserve (not paid / not finalised)`)
    }
  })

  it('a PAID order (Uzum PACKING) drops the shared available at order time', () => {
    // Pool 1; one PACKING order (paid) → pending 1 → available 0. This is the
    // moment the sibling target must fall — before any PVZ hand-off.
    const paidPending = ['PACKING'].filter(reserving).length   // = 1
    const group = [
      uzum({ physicalStock: 1, listedStock: 1, pending: paidPending }),
      ym({ physicalStock: 1, listedStock: 1, pending: 0 }),
    ]
    assert.equal(computeAvailable(group), 0)
  })

  it('an UNPAID draft (Uzum CREATED) leaves available untouched — no phantom stockout', () => {
    const draftPending = ['CREATED'].filter(reserving).length  // = 0 (excluded)
    const group = [
      uzum({ physicalStock: 1, listedStock: 1, pending: draftPending }),
      ym({ physicalStock: 1, listedStock: 1, pending: 0 }),
    ]
    assert.equal(computeAvailable(group), 1)   // still 1 — the sibling stays sellable
  })

  it("a paid order pushes the sibling's target DOWN, and a read-only sibling is never written", () => {
    // Last unit; a paid Uzum order reserves it. The Yandex stock_sync sibling's
    // target must drop to 0 (willWrite), closing the oversell window at order time.
    const paid = ['PACKING'].filter(reserving).length          // = 1
    const { available, plans } = planStockWrites(
      [uzum({ physicalStock: 1, listedStock: 1, pending: paid, apiMode: 'read_only' }),
       ym({ physicalStock: 1, listedStock: 1, pending: 0, apiMode: 'stock_sync' })],
      'off',
    )
    assert.equal(available, 0)
    // Read-only Uzum is never planned for a write.
    assert.ok(!plans.some(p => p.member.marketplace === 'uzum'))
    // The writable Yandex sibling is targeted to 0 and will actually be written.
    const ymPlan = plans.find(p => p.member.marketplace === 'yandex_market')
    assert.ok(ymPlan && ymPlan.target === 0 && ymPlan.willWrite)
  })

  it('cancel / return / collected release the unit (not in the reserving set)', () => {
    for (const s of ['CANCELED', 'CANCELLED', 'RETURNED', 'DELIVERED', 'COMPLETED', 'DELIVERED_TO_CUSTOMER_DELIVERY_POINT']) {
      assert.ok(!reserving(s), `${s} must NOT reserve — the unit is released / already in listed stock`)
    }
    // A group whose only order just cancelled → pending 0 → available back to full.
    const released = [uzum({ physicalStock: 2, pending: 0 }), ym({ physicalStock: 2, pending: 0 })]
    assert.equal(computeAvailable(released), 2)
  })
})

describe('computeAvailable', () => {
  it('MAX(stock) − SUM(pending), clamped at 0', () => {
    assert.equal(computeAvailable([uzum({ listedStock: 1, pending: 1 }), ym({ listedStock: 1, pending: 0 })]), 0)
    assert.equal(computeAvailable([uzum({ listedStock: 3, pending: 1 }), ym({ listedStock: 3 })]), 2)
    assert.equal(computeAvailable([uzum({ listedStock: 2, pending: 1 }), ym({ listedStock: 2 })]), 1)
    assert.equal(computeAvailable([uzum({ listedStock: 0, pending: 5 })]), 0)
  })
})

describe('computeAvailable — pool comes from physical_stock, NOT the throttled listing', () => {
  it('(a) physical_stock=2 with one pending reserving order → available=1 (NOT 0)', () => {
    // The real pool is 2, one unit reserved by an open order → 1 free.
    const members = [
      uzum({ physicalStock: 2, listedStock: 2, pending: 0 }),
      ym({ physicalStock: 2, listedStock: 2, pending: 1 }),
    ]
    assert.equal(computeAvailable(members), 1)
  })

  it('(b) throttling stock_quantity down to 1 does NOT lower available while physical_stock=2', () => {
    // Uzum listing was throttled to 1 (listedStock=1) but the pool is still 2.
    // Old code read MAX(listedStock)=1 − pending 1 = 0 (the ratchet). New code
    // reads MAX(physicalStock)=2 − 1 = 1. The pool is immune to our throttle.
    const members = [
      uzum({ physicalStock: 2, listedStock: 1, pending: 0 }),
      ym({ physicalStock: 2, listedStock: 1, pending: 1 }),
    ]
    assert.equal(computeAvailable(members), 1)
    // Prove the old (throttled-listing) math would have collapsed to 0:
    const oldStyle = Math.max(0, Math.max(1, 1) - 1)
    assert.equal(oldStyle, 0)
  })

  it('falls back to listedStock only while physical_stock is still NULL (seed)', () => {
    const members = [
      uzum({ physicalStock: null, listedStock: 3, pending: 1 }),
      ym({ physicalStock: null, listedStock: 3, pending: 0 }),
    ]
    assert.equal(computeAvailable(members), 2)   // seeds from listedStock=3
  })

  it('a member with a stale-low listing does not drag the pool below a peer physical_stock', () => {
    // YM physical NULL (seed 0 from a stale listing) must not beat Uzum physical 2.
    const members = [
      uzum({ physicalStock: 2, listedStock: 2, pending: 1 }),
      ym({ physicalStock: null, listedStock: 0, pending: 0 }),
    ]
    assert.equal(computeAvailable(members), 1)   // MAX(2, 0) − 1
  })
})

describe('physicalStockFromRead — our throttle never feeds the pool', () => {
  it('(c) a seller-originated listing change updates physical_stock (read adopted)', () => {
    assert.equal(physicalStockFromRead(5, 1), 5)      // read 5 ≠ our last write 1 → seller re-stocked
    assert.equal(physicalStockFromRead(2, 0), 2)      // read 2 ≠ our last write 0 → seller change
  })

  it('(d) our OWN throttle write (read equals our last target) does NOT change physical_stock', () => {
    assert.equal(physicalStockFromRead(1, 1), null)   // we wrote 1, listing reads 1 → ignore
    assert.equal(physicalStockFromRead(0, 0), null)
  })

  it('adopts the first-ever read of a product we have never written (lastSentTarget null)', () => {
    assert.equal(physicalStockFromRead(3, null), 3)   // seed the pool from the initial listing
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

describe('planGroupWrites — group-level reassert (stale-copy fix)', () => {
  it('reasserts a member whose listedStock===target when ANOTHER member is changing', () => {
    // The prod JMBLK case: Uzum listed 2 (a real diff → 1), Yandex listed 1 with
    // target 1 (equal — would normally skip). Yandex's DB copy is STALE (real 0),
    // so the group must reassert Yandex too. planGroupWrites returns BOTH.
    const plan = planStockWrites(
      [uzum({ listedStock: 2, pending: 1 }), ym({ listedStock: 1, pending: 0 })],
      'off',
    )
    assert.equal(plan.available, 1) // MAX(2,1) − 1
    const uzumPlan = plan.plans.find(p => p.member.shopId === 'uzum-shop')!
    const ymPlan = plan.plans.find(p => p.member.shopId === 'ym-shop')!
    assert.equal(uzumPlan.willWrite, true)   // 2 → 1, real diff
    assert.equal(ymPlan.willWrite, false)    // 1 → 1, equal (stale copy)
    const toWrite = planGroupWrites(plan)
    assert.equal(toWrite.length, 2)          // BOTH written — Yandex reasserted
    assert.ok(toWrite.some(p => p.member.shopId === 'ym-shop'))
    const ymWrite = toWrite.find(p => p.member.shopId === 'ym-shop')!
    assert.equal(ymWrite.target, 1)          // Yandex re-pushed to 1 (0→1 in reality)
  })

  it('writes NOTHING for a fully-unchanged group (strict no-op)', () => {
    // available 2, both already listing 2 → no member willWrite → no reassert.
    const plan = planStockWrites([uzum({ listedStock: 2, pending: 0 }), ym({ listedStock: 2 })], 'off')
    assert.equal(plan.plans.every(p => !p.willWrite), true)
    assert.equal(planGroupWrites(plan).length, 0)
  })
})

describe('stockWriteBack — keep the DB copy in lockstep with the live listing', () => {
  it('returns the target on a successful push that changed the value', () => {
    assert.equal(stockWriteBack('sent', 1, 0), 1)   // Yandex 0 → 1: write back 1
    assert.equal(stockWriteBack('sent', 1, 2), 1)   // Uzum 2 → 1: write back 1
  })
  it('returns null when the push did not succeed', () => {
    for (const s of ['skipped', 'blocked', 'killed', 'error']) {
      assert.equal(stockWriteBack(s, 1, 0), null)
    }
  })
  it('returns null when the copy already equals the target (no redundant write)', () => {
    assert.equal(stockWriteBack('sent', 1, 1), null)
  })
})

describe('detectNewOrders — notify on a NEW order, stay silent on reconcile', () => {
  it('flags a new reserving order (id not previously seen)', () => {
    const { hasNewOrder, nextSeen } = detectNewOrders(['orderA'], [])
    assert.equal(hasNewOrder, true)              // first sighting of orderA → notify
    assert.deepEqual(nextSeen.sort(), ['orderA'])
  })

  it('a pure reconcile run (same reserving set) is NOT a new order → silent', () => {
    const { hasNewOrder, nextSeen } = detectNewOrders(['orderA'], ['orderA'])
    assert.equal(hasNewOrder, false)             // no new id → reconcile only, silent
    assert.deepEqual(nextSeen, ['orderA'])
  })

  it('two consecutive runs with the SAME single order → new once, then silent', () => {
    // Run 1: nothing seen yet → new.
    const run1 = detectNewOrders(['orderA'], [])
    assert.equal(run1.hasNewOrder, true)
    // Run 2: seen carries orderA from run 1 → not new.
    const run2 = detectNewOrders(['orderA'], run1.nextSeen)
    assert.equal(run2.hasNewOrder, false)        // one digest total, not two
  })

  it('detects a NEW order even when count is unchanged (A delivered, B arrived)', () => {
    const { hasNewOrder, nextSeen } = detectNewOrders(['orderB'], ['orderA'])
    assert.equal(hasNewOrder, true)              // B is new despite same count of 1
    assert.deepEqual(nextSeen, ['orderB'])       // A pruned (left the reserving window)
  })

  it('an order LEAVING the window (delivered) is not a new order → silent', () => {
    const { hasNewOrder, nextSeen } = detectNewOrders([], ['orderA'])
    assert.equal(hasNewOrder, false)             // set shrank, nothing new
    assert.deepEqual(nextSeen, [])
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

describe('shouldAdoptPhysicalStock — reconcile stopgap (order-decrement aware)', () => {
  it('THE KBWHT RATCHET: an order-decrement is NOT adopted (pool held)', () => {
    // pool 2, one order qty 1 → we pushed available 1; Uzum then nets the same
    // order off its listing → reads 0. drop (1) == pending (1) → order-decrement.
    assert.equal(shouldAdoptPhysicalStock(0, 1, 1), false)   // fix: do NOT collapse the pool
    // Prove the OLD exact-match rule would have adopted 0 (the bug):
    assert.equal(physicalStockFromRead(0, 1), 0)             // 0 !== 1 → adopted → pool → 0
  })

  it('our own write coming back is never adopted', () => {
    assert.equal(shouldAdoptPhysicalStock(1, 1, 1), false)
    assert.equal(shouldAdoptPhysicalStock(0, 0, 0), false)
  })

  it('a genuine restock UP is adopted', () => {
    assert.equal(shouldAdoptPhysicalStock(5, 1, 1), true)
    assert.equal(shouldAdoptPhysicalStock(3, null, 0), true)  // never-written → adopt
  })

  it('a drop BEYOND the open reserving units is a real seller reduction → adopted', () => {
    assert.equal(shouldAdoptPhysicalStock(0, 3, 1), true)     // dropped 3, only 1 pending
    assert.equal(shouldAdoptPhysicalStock(2, 5, 0), true)     // no pending at all
  })

  // ── The two ACCEPTED holes (documented in the PR — closed only by the ledger) ──
  it('HOLE 1: a genuine seller reduction WITHIN the band is (wrongly) ignored', () => {
    // Seller really removed the unit (sold elsewhere) while an order is open, to a
    // value inside the order-decrement band — indistinguishable by value alone.
    assert.equal(shouldAdoptPhysicalStock(0, 1, 1), false)   // real change, silently dropped
  })
  it('HOLE 2: a restore-on-cancel (upward, pending gone) is (wrongly) adopted as a restock', () => {
    // Order cancelled → pending 0; marketplace bumps the listing back up → looks
    // like a restock and ratchets the pool UP.
    assert.equal(shouldAdoptPhysicalStock(2, 1, 0), true)
  })
})

// ── Issue #393: PBGRY re-pushed the same value every 15–20 min ──────────────
//
// The only no-op check the write path had was `target !== listedStock`
// (willWrite), and the group reassert bypasses it on purpose: any member with a
// diff re-pushes EVERY member. stock_sync_state.last_target already recorded
// what we sent and nothing read it, so nothing could tell a re-push that is
// doing something from one that is repeating itself. PBGRY pushed 1 to both
// marketplaces every 15–20 minutes for hours against a ~100k/day Uzum cap.
describe('decidePush — a repeat is not a write', () => {
  const plan = (target: number, listed: number): PlannedWrite => ({
    member: {
      productId: 'p', shopId: 's', marketplace: 'uzum', apiMode: 'stock_sync',
      priority: 0, listedStock: listed, physicalStock: listed, pending: 0, sku: 'PBGRY',
    },
    target,
    willWrite: target !== listed,
  })

  it('pushes a member with a real diff', () => {
    const d = decidePush(plan(1, 0), { lastTarget: 1, repeatCount: 1 })
    assert.equal(d.push, true)
  })

  it('skips the reassert sibling that already shows a value we sent', () => {
    // THE BUG: listed === target, and we already pushed that target. This member
    // is being re-pushed on another member's behalf and has nothing to say.
    const d = decidePush(plan(1, 1), { lastTarget: 1, repeatCount: 3 })
    assert.equal(d.push, false)
    assert.equal(d.push === false && d.reason, 'already_at_target')
  })

  it('resets the run once the listing agrees', () => {
    const d = decidePush(plan(1, 1), { lastTarget: 1, repeatCount: 4 })
    assert.equal(d.push === false && d.repeatCount, 0)
  })

  it('still reasserts a member we have NOT sent this value to', () => {
    // The stale-copy case the reassert exists for: our stock_quantity says 1 so
    // there is no diff, but we have never actually pushed 1 to this listing.
    const d = decidePush(plan(1, 1), { lastTarget: 0, repeatCount: 9 })
    assert.equal(d.push, true)
  })

  it('pushes when there is no history at all', () => {
    assert.equal(decidePush(plan(1, 1), undefined).push, true)
  })

  it('gives up on a value the listing never converges on', () => {
    const d = decidePush(plan(1, 0), { lastTarget: 1, repeatCount: NON_CONVERGENCE_LIMIT })
    assert.equal(d.push, false)
    assert.equal(d.push === false && d.reason, 'not_converging')
  })

  it('counts the run, and a changed target starts a new one', () => {
    assert.equal(decidePush(plan(1, 0), { lastTarget: 1, repeatCount: 2 }).repeatCount, 3)
    assert.equal(decidePush(plan(2, 0), { lastTarget: 1, repeatCount: 4 }).repeatCount, 1)
  })

  it('PBGRY: the loop terminates instead of running forever', () => {
    // Replay the reported symptom — target 1, listing never agrees — and count
    // the marketplace calls. Before this guard the answer was "every cycle,
    // forever"; 40 cycles is ~13 hours at the observed 20-minute cadence.
    let history: PushHistory | undefined = undefined
    let calls = 0
    for (let cycle = 0; cycle < 40; cycle++) {
      const d = decidePush(plan(1, 0), history)
      if (d.push) calls++
      history = { lastTarget: 1, repeatCount: d.repeatCount }
    }
    assert.equal(calls, NON_CONVERGENCE_LIMIT,
      'a value that never lands must stop costing marketplace calls')
  })
})
