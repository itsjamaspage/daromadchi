// Pure tests for entitlement. Run: node --import tsx --test lib/billing/features.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  hasFeature, computeEffectivePlan, isOnTrial, trialEndFrom, TRIAL_DAYS,
  type EntitlementInput, type Feature,
} from './features'

const NOW = new Date('2026-08-18T12:00:00Z')
const soon = (days: number) => new Date(NOW.getTime() + days * 86_400_000)
const ago  = (days: number) => new Date(NOW.getTime() - days * 86_400_000)

const FREE_FOREVER: Feature[] = ['dashboard', 'products', 'orders', 'marketplaces']
const GATED: Feature[] = ['analytics', 'stock_sync', 'finances', 'unit_economics']

const freeNoTrial:   EntitlementInput = { plan: 'free', planExpiresAt: null, trialEndsAt: ago(1) }
const freeOnTrial:   EntitlementInput = { plan: 'free', planExpiresAt: null, trialEndsAt: soon(5) }
const freeNeverSeen: EntitlementInput = { plan: 'free', planExpiresAt: null, trialEndsAt: null }
const paidPro:       EntitlementInput = { plan: 'pro',  planExpiresAt: soon(30), trialEndsAt: null }
const lapsedPro:     EntitlementInput = { plan: 'pro',  planExpiresAt: ago(1),   trialEndsAt: null }

describe('free forever vs trial-then-gated', () => {
  it('a free account past its trial keeps dashboard, products, orders, marketplaces', () => {
    for (const f of FREE_FOREVER) {
      assert.equal(hasFeature(freeNoTrial, f, NOW), true, f)
    }
  })
  it('...and loses analytics, stock sync, finances, unit economics', () => {
    for (const f of GATED) {
      assert.equal(hasFeature(freeNoTrial, f, NOW), false, f)
    }
  })
  it('inside the trial, a free account gets everything', () => {
    for (const f of [...FREE_FOREVER, ...GATED]) {
      assert.equal(hasFeature(freeOnTrial, f, NOW), true, f)
    }
  })
})

describe('paid plans', () => {
  it('an active paid plan gets everything', () => {
    for (const f of [...FREE_FOREVER, ...GATED]) {
      assert.equal(hasFeature(paidPro, f, NOW), true, f)
    }
  })
  it('a LAPSED paid plan is treated as free, not as paid', () => {
    assert.equal(computeEffectivePlan(lapsedPro, NOW), 'free')
    for (const f of GATED) assert.equal(hasFeature(lapsedPro, f, NOW), false, f)
    for (const f of FREE_FOREVER) assert.equal(hasFeature(lapsedPro, f, NOW), true, f)
  })
})

describe('biznes behaves as an ordinary paid tier', () => {
  // It became card-payable in its own right; nothing in entitlement should treat
  // it as a special case, and a lapsed biznes must fall back to free like any
  // other paid plan rather than keeping access.
  const biznes:       EntitlementInput = { plan: 'biznes', planExpiresAt: soon(30), trialEndsAt: null }
  const lapsedBiznes: EntitlementInput = { plan: 'biznes', planExpiresAt: ago(1),   trialEndsAt: null }

  it('an active biznes plan unlocks everything', () => {
    assert.equal(computeEffectivePlan(biznes, NOW), 'biznes')
    for (const f of [...FREE_FOREVER, ...GATED]) {
      assert.equal(hasFeature(biznes, f, NOW), true, f)
    }
  })
  it('a lapsed biznes plan falls back to free', () => {
    assert.equal(computeEffectivePlan(lapsedBiznes, NOW), 'free')
    for (const f of GATED) assert.equal(hasFeature(lapsedBiznes, f, NOW), false, f)
  })
  it('a biznes plan is never "on trial"', () => {
    assert.equal(isOnTrial({ ...biznes, trialEndsAt: soon(5) }, NOW), false)
  })
  it('grandfathering still wins over everything, including biznes', () => {
    const grandfathered: EntitlementInput = { ...lapsedBiznes, isGrandfathered: true }
    for (const f of GATED) assert.equal(hasFeature(grandfathered, f, NOW), true, f)
  })
})

describe('grandfathering is checked FIRST', () => {
  // The whole point: an old-price account must not be gated by a rule written
  // after they subscribed — even if every other signal says "free".
  const grandfathered: EntitlementInput = {
    plan: 'free', planExpiresAt: ago(400), trialEndsAt: ago(400), isGrandfathered: true,
  }
  it('overrides a lapsed plan and an expired trial', () => {
    for (const f of [...FREE_FOREVER, ...GATED]) {
      assert.equal(hasFeature(grandfathered, f, NOW), true, f)
    }
  })
  it('is not granted by default', () => {
    assert.equal(hasFeature(freeNoTrial, 'analytics', NOW), false)
  })
})

describe('trial window boundaries', () => {
  it('is open strictly before the end instant and closed at it', () => {
    const oneMsBefore: EntitlementInput = { plan: 'free', planExpiresAt: null, trialEndsAt: new Date(NOW.getTime() + 1) }
    const exactly:     EntitlementInput = { plan: 'free', planExpiresAt: null, trialEndsAt: NOW }
    assert.equal(isOnTrial(oneMsBefore, NOW), true)
    assert.equal(isOnTrial(exactly, NOW), false)
  })
  it('a null trial date is not a trial — it is decided when the trial is first set', () => {
    assert.equal(isOnTrial(freeNeverSeen, NOW), false)
  })
  it('a paid plan is never "on trial"', () => {
    assert.equal(isOnTrial({ ...paidPro, trialEndsAt: soon(5) }, NOW), false)
  })
  it(`trialEndFrom adds ${TRIAL_DAYS} days`, () => {
    assert.equal(trialEndFrom(NOW).getTime(), soon(TRIAL_DAYS).getTime())
  })
})

describe('degenerate input', () => {
  it('a null plan behaves as free', () => {
    assert.equal(computeEffectivePlan({ plan: null, planExpiresAt: null, trialEndsAt: null }, NOW), 'free')
  })
  it('an unparseable date is treated as absent, not as "now"', () => {
    const bad: EntitlementInput = { plan: 'pro', planExpiresAt: 'not-a-date', trialEndsAt: null }
    // Unreadable expiry must not silently expire a paying customer.
    assert.equal(computeEffectivePlan(bad, NOW), 'pro')
  })
  it('ISO strings work as well as Date objects', () => {
    const iso: EntitlementInput = { plan: 'free', planExpiresAt: null, trialEndsAt: soon(3).toISOString() }
    assert.equal(hasFeature(iso, 'analytics', NOW), true)
  })
})
