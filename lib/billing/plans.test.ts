// Pure tests for the tiyin price anchor + conversions.
// Run: node --import tsx --test lib/billing/plans.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAN_PRICES_TIYIN, ANNUAL_DISCOUNT_PCT, planAnnualTotalTiyin,
  somToTiyin, tiyinToSom, planAmountTiyin, planPeriodMonths,
  formatSomFromTiyin, annualMonthlySom,
} from './plans'

describe('tiyin ↔ so\'m conversion (the 100× boundary)', () => {
  it('somToTiyin multiplies by 100; tiyinToSom divides by 100', () => {
    assert.equal(somToTiyin(250_000), 25_000_000)
    assert.equal(tiyinToSom(25_000_000), 250_000)
    assert.equal(somToTiyin(1), 100)
    assert.equal(tiyinToSom(100), 1)
  })
  it('round-trips exactly for the anchor prices', () => {
    for (const key of ['pro', 'pro_plus'] as const) {
      const t = PLAN_PRICES_TIYIN[key].monthly
      assert.equal(somToTiyin(tiyinToSom(t)), t)
    }
  })
})

describe('annual is DERIVED from monthly (no hardcoded yearly)', () => {
  // Assert the relationship, not absolute prices, so these survive a monthly
  // price change (e.g. a temporary test price) without going stale.
  for (const key of ['pro', 'pro_plus'] as const) {
    it(`${key}: yearly = monthly × 12 − ${ANNUAL_DISCOUNT_PCT[key]}%`, () => {
      const monthly = PLAN_PRICES_TIYIN[key].monthly
      const expected = Math.round((monthly * 12 * (100 - ANNUAL_DISCOUNT_PCT[key])) / 100)
      assert.equal(planAnnualTotalTiyin(key), expected)
      // planAmountTiyin routes to the derived yearly / the monthly.
      assert.equal(planAmountTiyin(key, 'annual'), expected)
      assert.equal(planAmountTiyin(key, 'monthly'), monthly)
      // The per-month figure on the yearly toggle is the yearly total / 12.
      assert.equal(annualMonthlySom(key), Math.round(tiyinToSom(expected) / 12))
    })
  }
  it('at the default 250 000 / 500 000 monthly, yearly = 2 400 000 / 4 500 000', () => {
    // Only checks the derivation math against the intended anchors; skipped in
    // spirit whenever a temporary test monthly is in effect.
    if (PLAN_PRICES_TIYIN.pro.monthly === 25_000_000) {
      assert.equal(planAnnualTotalTiyin('pro'), 240_000_000)      // 2 400 000 so'm (200 000/mo)
    }
    if (PLAN_PRICES_TIYIN.pro_plus.monthly === 50_000_000) {
      assert.equal(planAnnualTotalTiyin('pro_plus'), 450_000_000) // 4 500 000 so'm (375 000/mo)
    }
  })
  it('planPeriodMonths: monthly=1, annual=12', () => {
    assert.equal(planPeriodMonths('monthly'), 1)
    assert.equal(planPeriodMonths('annual'), 12)
  })
})

describe('formatSomFromTiyin', () => {
  it('space-groups thousands from a tiyin amount', () => {
    assert.equal(formatSomFromTiyin(25_000_000), '250 000')
    assert.equal(formatSomFromTiyin(50_000_000), '500 000')
    assert.equal(formatSomFromTiyin(100), '1')
  })
})
