// DB-free test for the oversell alert DEDUP decision — proving one alert per
// distinct oversell situation, not one per 5-min reconcile cycle.
// Run: node --import tsx --test lib/marketplace/oversell.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isDuplicateOversell } from './oversell'

describe('isDuplicateOversell — one alert per situation, not per cycle', () => {
  it('suppresses the SAME oversell (same later order + same oversold amount)', () => {
    const prev = { orderExt: '60137441539', oversoldBy: 1 }
    // The next 5-min cycle sees the identical unresolved oversell → suppress.
    assert.equal(isDuplicateOversell(prev, { orderExt: '60137441539', oversoldBy: 1 }), true)
  })

  it('alerts again when a NEW later order causes the oversell', () => {
    const prev = { orderExt: '60137441539', oversoldBy: 1 }
    assert.equal(isDuplicateOversell(prev, { orderExt: '60137441540', oversoldBy: 1 }), false)
  })

  it('alerts again when the oversell gets DEEPER (oversold amount grows)', () => {
    const prev = { orderExt: '60137441539', oversoldBy: 1 }
    assert.equal(isDuplicateOversell(prev, { orderExt: '60137441539', oversoldBy: 2 }), false)
  })

  it('alerts when there is no prior alert (first detection)', () => {
    assert.equal(isDuplicateOversell(null, { orderExt: '60137441539', oversoldBy: 1 }), false)
    assert.equal(isDuplicateOversell(undefined, { orderExt: 'X', oversoldBy: 1 }), false)
  })

  it('treats a null stored order and a null current order as the same (still suppress)', () => {
    const prev = { orderExt: null, oversoldBy: 1 }
    assert.equal(isDuplicateOversell(prev, { orderExt: null, oversoldBy: 1 }), true)
  })
})
