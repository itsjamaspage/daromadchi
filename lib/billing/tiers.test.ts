// Pure tests for turnover → tier assignment.
// Run: node --import tsx --test lib/billing/tiers.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assignTier, shouldTriggerEnterpriseOutreach,
  ENTERPRISE_POPUP_THRESHOLD, TURNOVER_BANDS, type Tier,
} from './tiers'

describe('band boundaries — the so\'m either side of every edge', () => {
  // Each pair is (last so'm of the lower tier, first so'm of the upper tier).
  // A one-so'm error here is a seller billed the wrong tier, so both sides of
  // every boundary are asserted explicitly rather than by loop over the bands.
  const edges: [number, Tier, number, Tier][] = [
    [ 11_999_999, 'free',     12_000_000, 'pro'        ],
    [ 49_999_999, 'pro',      50_000_000, 'pro_plus'   ],
    [119_999_999, 'pro_plus', 120_000_000, 'biznes'    ],
    [179_999_999, 'biznes',   180_000_000, 'enterprise'],
  ]
  for (const [below, belowTier, at, atTier] of edges) {
    it(`${below.toLocaleString('en-US')} is ${belowTier}, ${at.toLocaleString('en-US')} is ${atTier}`, () => {
      assert.equal(assignTier(below), belowTier)
      assert.equal(assignTier(at), atTier)
    })
  }
})

describe('boundaries are inclusive at the bottom', () => {
  it('a band minimum belongs to that band, never the one below', () => {
    for (const { tier, min } of TURNOVER_BANDS) {
      assert.equal(assignTier(min), tier, `${min} should be ${tier}`)
    }
  })
})

describe('degenerate input fails safe (down, never up)', () => {
  it('zero turnover is free', () => {
    assert.equal(assignTier(0), 'free')
  })
  it('negative turnover is free, not a crash or a paid tier', () => {
    assert.equal(assignTier(-1), 'free')
    assert.equal(assignTier(-999_999_999), 'free')
  })
  it('NaN and Infinity are free — a broken aggregate must never bill Enterprise', () => {
    assert.equal(assignTier(Number.NaN), 'free')
    assert.equal(assignTier(Number.POSITIVE_INFINITY), 'free')
    assert.equal(assignTier(Number.NEGATIVE_INFINITY), 'free')
  })
})

describe('typical turnovers land where a seller would expect', () => {
  it('mid-band values map to their band', () => {
    assert.equal(assignTier(8_000_000),   'free')
    assert.equal(assignTier(30_000_000),  'pro')
    assert.equal(assignTier(95_000_000),  'pro_plus')
    assert.equal(assignTier(150_000_000), 'biznes')
    assert.equal(assignTier(500_000_000), 'enterprise')
  })
})

describe('enterprise outreach threshold', () => {
  it('fires at 162 mln and above, inside the Biznes band', () => {
    assert.equal(shouldTriggerEnterpriseOutreach(ENTERPRISE_POPUP_THRESHOLD - 1), false)
    assert.equal(shouldTriggerEnterpriseOutreach(ENTERPRISE_POPUP_THRESHOLD), true)
    // Still Biznes at the trigger point — outreach precedes the tier change.
    assert.equal(assignTier(ENTERPRISE_POPUP_THRESHOLD), 'biznes')
  })
  it('does not fire on degenerate input', () => {
    assert.equal(shouldTriggerEnterpriseOutreach(Number.NaN), false)
    assert.equal(shouldTriggerEnterpriseOutreach(Number.POSITIVE_INFINITY), false)
  })
})
