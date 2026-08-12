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
    assert.equal(somToTiyin(252_000), 25_200_000)
    assert.equal(tiyinToSom(25_200_000), 252_000)
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
  it('Pro = 25 200 000 tiyin (252 000 so\'m), Pro+ = 50 400 000 tiyin (504 000 so\'m)', () => {
    assert.equal(PLAN_PRICES_TIYIN.pro.monthly, 25_200_000)
    assert.equal(PLAN_PRICES_TIYIN.pro_plus.monthly, 50_400_000)
    assert.equal(tiyinToSom(PLAN_PRICES_TIYIN.pro.monthly), 252_000)
    assert.equal(tiyinToSom(PLAN_PRICES_TIYIN.pro_plus.monthly), 504_000)
  })
  it('annual totals are 12 × the annual-monthly figure (3 months free applied)', () => {
    assert.equal(PLAN_PRICES_TIYIN.pro.annualTotal, 226_800_000)      // 2 268 000 so'm
    assert.equal(PLAN_PRICES_TIYIN.pro_plus.annualTotal, 453_600_000) // 4 536 000 so'm
    assert.equal(annualMonthlySom('pro'), 189_000)
    assert.equal(annualMonthlySom('pro_plus'), 378_000)
  })
  it('planAmountTiyin picks monthly vs annualTotal', () => {
    assert.equal(planAmountTiyin('pro', 'monthly'), 25_200_000)
    assert.equal(planAmountTiyin('pro', 'annual'), 226_800_000)
    assert.equal(planAmountTiyin('pro_plus', 'monthly'), 50_400_000)
  })
  it('planPeriodMonths: monthly=1, annual=12', () => {
    assert.equal(planPeriodMonths('monthly'), 1)
    assert.equal(planPeriodMonths('annual'), 12)
  })
})

describe('formatSomFromTiyin', () => {
  it('space-groups thousands from a tiyin amount', () => {
    assert.equal(formatSomFromTiyin(25_200_000), '252 000')
    assert.equal(formatSomFromTiyin(50_400_000), '504 000')
    assert.equal(formatSomFromTiyin(100), '1')
  })
})
