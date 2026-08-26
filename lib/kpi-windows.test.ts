/**
 * The dashboard's % badges compare a period against the same length immediately
 * before it. For the default view — the current Mon–Sun week — that is last week.
 *
 * Every assertion below is written in Asia/Tashkent (UTC+5), because the bug
 * being fixed was invisible in UTC: `new Date('2026-08-24')` parses as UTC
 * midnight, so anywhere east of Greenwich the window silently began hours late
 * and the baseline overlapped the period it was supposed to compare against.
 *
 * The npm script PINS TZ=Asia/Tashkent, deliberately. Under UTC these
 * assertions would pass against the old broken code too — which is exactly how
 * the skew went unnoticed: the server runs UTC, where `new Date('2026-08-24')`
 * and local midnight are the same instant. Pinning the seller's zone is what
 * makes the test able to fail.
 *
 * Run: npm run test:kpi-windows
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { kpiWindows, inclusiveDays } from './kpi-windows'

const f = (d: Date | null) =>
  d === null ? null : d.toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' })

describe('a Mon–Sun week compares against the previous Mon–Sun week', () => {
  const w = kpiWindows({ from: '2026-08-24', to: '2026-08-30' })

  it('starts at local midnight, not 05:00', () => {
    // The reported symptom: the first five hours of Monday were missing.
    assert.equal(f(w.since), '2026-08-24 00:00:00')
    assert.equal(f(w.until), '2026-08-30 23:59:59')
  })

  it('compares against Mon 17 – Sun 23, whole and non-overlapping', () => {
    // Was: Mon 17 Aug 10:00 → Mon 24 Aug 04:59 — ten hours out at the start and
    // reaching into the week under comparison.
    assert.equal(f(w.prevSince), '2026-08-17 00:00:00')
    assert.equal(f(w.prevUntil), '2026-08-23 23:59:59')
  })

  it('leaves no gap and no overlap between the two windows', () => {
    assert.equal(w.prevUntil!.getTime() + 1, w.since!.getTime(),
      'the baseline must end exactly where the period begins')
  })

  it('gives both windows the same length', () => {
    assert.equal(w.until!.getTime() - w.since!.getTime(),
                 w.prevUntil!.getTime() - w.prevSince!.getTime())
  })
})

describe('the baseline is always the same length, immediately before', () => {
  it('a 30-day preset compares against the previous 30 days', () => {
    const w = kpiWindows({ days: 30, now: new Date(2026, 7, 26, 14, 30) })
    assert.equal(f(w.since), '2026-07-28 00:00:00')
    assert.equal(f(w.until), '2026-08-26 23:59:59')
    assert.equal(f(w.prevSince), '2026-06-28 00:00:00')
    assert.equal(f(w.prevUntil), '2026-07-27 23:59:59')
  })

  it('anchors a preset to midnight, not to the time the page was opened', () => {
    // Two visits on the same day must describe the same window, or the number
    // moves for a reason the seller cannot see.
    const morning = kpiWindows({ days: 7, now: new Date(2026, 7, 26, 6, 0) })
    const evening = kpiWindows({ days: 7, now: new Date(2026, 7, 26, 23, 0) })
    assert.deepEqual(f(morning.since), f(evening.since))
    assert.deepEqual(f(morning.prevSince), f(evening.prevSince))
  })

  it('never lets the boundary instant fall in both windows', () => {
    // The old preset branch set prevUntil = since exactly.
    const w = kpiWindows({ days: 7, now: new Date(2026, 7, 26, 9, 0) })
    assert.ok(w.prevUntil!.getTime() < w.since!.getTime())
  })

  it('handles a custom range of any length', () => {
    const w = kpiWindows({ from: '2026-08-10', to: '2026-08-12' })   // 3 days
    assert.equal(f(w.since), '2026-08-10 00:00:00')
    assert.equal(f(w.prevSince), '2026-08-07 00:00:00')
    assert.equal(f(w.prevUntil), '2026-08-09 23:59:59')
  })

  it('handles a single day comparing to the day before', () => {
    const w = kpiWindows({ from: '2026-08-26', to: '2026-08-26' })
    assert.equal(f(w.prevSince), '2026-08-25 00:00:00')
    assert.equal(f(w.prevUntil), '2026-08-25 23:59:59')
  })

  it('crosses a month boundary without drifting', () => {
    const w = kpiWindows({ from: '2026-09-01', to: '2026-09-07' })
    assert.equal(f(w.prevSince), '2026-08-25 00:00:00')
    assert.equal(f(w.prevUntil), '2026-08-31 23:59:59')
  })

  it('crosses a year boundary without drifting', () => {
    const w = kpiWindows({ from: '2027-01-04', to: '2027-01-10' })
    assert.equal(f(w.prevSince), '2026-12-28 00:00:00')
    assert.equal(f(w.prevUntil), '2027-01-03 23:59:59')
  })
})

describe('no comparison when there is no period', () => {
  it('returns nulls rather than inventing a window', () => {
    assert.deepEqual(kpiWindows({}), { since: null, until: null, prevSince: null, prevUntil: null })
  })
})

describe('inclusiveDays', () => {
  it('counts Mon–Sun as 7, not 6', () => {
    assert.equal(inclusiveDays('2026-08-24', '2026-08-30'), 7)
    assert.equal(inclusiveDays('2026-08-26', '2026-08-26'), 1)
    assert.equal(inclusiveDays('2026-08-01', '2026-08-31'), 31)
  })
})
