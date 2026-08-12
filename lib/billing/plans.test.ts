// Pure tests for the tiyin price anchor + conversions.
// Run: node --import tsx --test lib/billing/plans.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAN_PRICES_TIYIN, somToTiyin, tiyinToSom, planAmountTiyin, planPeriodMonths,
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

describe('anchor amounts', () => {
  it('Pro = 25 000 000 tiyin (250 000 so\'m), Pro+ = 50 000 000 tiyin (500 000 so\'m)', () => {
    assert.equal(PLAN_PRICES_TIYIN.pro.monthly, 25_000_000)
    assert.equal(PLAN_PRICES_TIYIN.pro_plus.monthly, 50_000_000)
    assert.equal(tiyinToSom(PLAN_PRICES_TIYIN.pro.monthly), 250_000)
    assert.equal(tiyinToSom(PLAN_PRICES_TIYIN.pro_plus.monthly), 500_000)
  })
  it('annual totals = monthly × 9 (3 months free)', () => {
    assert.equal(PLAN_PRICES_TIYIN.pro.annualTotal, 225_000_000)      // 2 250 000 so'm
    assert.equal(PLAN_PRICES_TIYIN.pro_plus.annualTotal, 450_000_000) // 4 500 000 so'm
    // Sanity: annualTotal is exactly 9× the monthly so'm.
    assert.equal(tiyinToSom(PLAN_PRICES_TIYIN.pro.annualTotal), 250_000 * 9)
    assert.equal(tiyinToSom(PLAN_PRICES_TIYIN.pro_plus.annualTotal), 500_000 * 9)
    // Per-month figure shown on the annual toggle (annualTotal / 12).
    assert.equal(annualMonthlySom('pro'), 187_500)
    assert.equal(annualMonthlySom('pro_plus'), 375_000)
  })
  it('planAmountTiyin picks monthly vs annualTotal', () => {
    assert.equal(planAmountTiyin('pro', 'monthly'), 25_000_000)
    assert.equal(planAmountTiyin('pro', 'annual'), 225_000_000)
    assert.equal(planAmountTiyin('pro_plus', 'monthly'), 50_000_000)
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
