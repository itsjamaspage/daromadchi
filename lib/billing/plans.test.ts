// Pure tests for the tiyin price anchor + conversions.
// Run: node --import tsx --test lib/billing/plans.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAN_PRICES_TIYIN, annualDiscountPct, planAnnualTotalTiyin,
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

describe('yearly is the stated per-month price × 12', () => {
  // Assert the relationship, not absolute prices, so these survive a price
  // change without going stale.
  for (const key of ['pro', 'pro_plus'] as const) {
    it(`${key}: yearly total = annualPerMonth × 12`, () => {
      const { monthly, annualPerMonth } = PLAN_PRICES_TIYIN[key]
      assert.equal(planAnnualTotalTiyin(key), annualPerMonth * 12)
      assert.equal(planAmountTiyin(key, 'annual'), annualPerMonth * 12)
      assert.equal(planAmountTiyin(key, 'monthly'), monthly)
      // The per-month figure on the yearly toggle must be EXACTLY the price we
      // advertise — this is the check that a derived-from-percentage yearly
      // would fail, billing 124 500 against an advertised 125 000.
      assert.equal(annualMonthlySom(key), tiyinToSom(annualPerMonth))
    })
    it(`${key}: yearly is cheaper per month than monthly`, () => {
      const { monthly, annualPerMonth } = PLAN_PRICES_TIYIN[key]
      assert.ok(annualPerMonth < monthly, 'a yearly commitment must save money')
      assert.ok(annualDiscountPct(key) > 0, 'the badge must show a real saving')
    })
  }

  it('the turnover ladder prices are what is charged', () => {
    assert.equal(tiyinToSom(PLAN_PRICES_TIYIN.pro.monthly), 150_000)
    assert.equal(tiyinToSom(PLAN_PRICES_TIYIN.pro.annualPerMonth), 125_000)
    assert.equal(tiyinToSom(PLAN_PRICES_TIYIN.pro_plus.monthly), 250_000)
    assert.equal(tiyinToSom(PLAN_PRICES_TIYIN.pro_plus.annualPerMonth), 225_000)
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
