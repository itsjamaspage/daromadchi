/**
 * Regression: Uzum order date must never silently become the sync time.
 *
 * The P&L, dashboard and revenue chart all bucket a sale by orders.ordered_at
 * — the day the order was PLACED. parseOrderedAt used to fall back to
 * `new Date()` when a payload carried no parseable date, and the sync's update
 * path wrote that value on EVERY poll. An active order therefore had its real
 * order date walked forward to "today" on each sync, collapsing many days of
 * sales onto a single bar in the chart (the bug in
 * docs/investigations/pnl-single-day-revenue-findings.md).
 *
 * The fix: parseOrderedAt returns null on a missing/garbage date; the caller
 * uses now() ONLY for a brand-new insert and never overwrites a stored date
 * with null on update. This test pins the null contract and the parse cases.
 *
 * Run: node --import tsx --test lib/uzum/ordered-at.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseOrderedAt } from './sync'

describe('parseOrderedAt', () => {
  it('returns null — NOT now() — for a missing or unparseable date', () => {
    // This is the whole point: a null lets the caller preserve the stored
    // order date on re-sync instead of stamping it with the sync time.
    assert.equal(parseOrderedAt(undefined), null, 'undefined')
    assert.equal(parseOrderedAt(null), null, 'null')
    assert.equal(parseOrderedAt(''), null, 'empty string')
    assert.equal(parseOrderedAt('not a date'), null, 'garbage string')
    assert.equal(parseOrderedAt({}), null, 'object')
  })

  it('parses an ISO string to that exact instant', () => {
    const d = parseOrderedAt('2026-08-24T09:30:00.000Z')
    assert.ok(d instanceof Date)
    assert.equal(d!.toISOString(), '2026-08-24T09:30:00.000Z')
  })

  it('parses epoch milliseconds (number and numeric string)', () => {
    const ms = Date.UTC(2026, 7, 25, 12, 0, 0) // 25 Aug 2026
    assert.equal(parseOrderedAt(ms)!.toISOString(), new Date(ms).toISOString())
    assert.equal(parseOrderedAt(String(ms))!.toISOString(), new Date(ms).toISOString())
  })

  it('parses epoch seconds (10-digit) by scaling to milliseconds', () => {
    const sec = Math.floor(Date.UTC(2026, 7, 26, 0, 0, 0) / 1000)
    assert.equal(parseOrderedAt(sec)!.toISOString(), new Date(sec * 1000).toISOString())
    assert.equal(parseOrderedAt(String(sec))!.toISOString(), new Date(sec * 1000).toISOString())
  })

  it('distinct real order dates stay distinct — they do not collapse onto one day', () => {
    // The shape of the reported bug: three sales placed on three different days
    // must yield three different calendar days, never one.
    const days = ['2026-08-24T08:00:00Z', '2026-08-25T08:00:00Z', '2026-08-26T08:00:00Z']
      .map(s => parseOrderedAt(s)!.toISOString().slice(0, 10))
    assert.deepEqual(days, ['2026-08-24', '2026-08-25', '2026-08-26'])
  })
})
