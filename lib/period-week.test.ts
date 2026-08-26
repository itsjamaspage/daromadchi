import { test, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isoWeekKey, startOfIsoWeek, endOfIsoWeek, isoWeekBounds, localDateStr, currentIsoWeekKey,
  parseLocalDate, shiftLocalDate, isCalendarWeek,
} from './period-week'

const d = (s: string) => { const [y, m, day] = s.split('-').map(Number); return new Date(y, m - 1, day) }

test('weeks start Monday and end Sunday', () => {
  // 2026-08-21 is a Friday.
  assert.equal(localDateStr(startOfIsoWeek(d('2026-08-21'))), '2026-08-17') // Monday
  assert.equal(localDateStr(endOfIsoWeek(d('2026-08-21'))),   '2026-08-23') // Sunday
})

test('Monday is its own week start; Sunday belongs to the week before it', () => {
  assert.equal(localDateStr(startOfIsoWeek(d('2026-08-17'))), '2026-08-17')
  // The trap: JS getDay() makes Sunday 0, so a naive shift sends it forward a week.
  assert.equal(localDateStr(startOfIsoWeek(d('2026-08-23'))), '2026-08-17')
})

test('every day of one week maps to the same key', () => {
  const keys = ['2026-08-17','2026-08-18','2026-08-19','2026-08-20','2026-08-21','2026-08-22','2026-08-23']
    .map(s => isoWeekKey(d(s)))
  assert.equal(new Set(keys).size, 1, keys.join(','))
  assert.equal(keys[0], '2026-W34')
})

test('the next Monday starts a new key — this is what makes a week roll into history', () => {
  assert.equal(isoWeekKey(d('2026-08-23')), '2026-W34')  // Sunday, still current
  assert.equal(isoWeekKey(d('2026-08-24')), '2026-W35')  // Monday, new week
})

// ISO's year rule: a week belongs to the year containing its Thursday. Naive
// day-of-year arithmetic gets both of these wrong.
test('year boundaries follow the Thursday rule, not the calendar year', () => {
  assert.equal(isoWeekKey(d('2027-01-01')), '2026-W53') // Friday → previous year's last week
  assert.equal(isoWeekKey(d('2025-12-31')), '2026-W01') // Wednesday → next year's first week
  assert.equal(isoWeekKey(d('2026-01-01')), '2026-W01') // Thursday → decides its own year
})

test('keys sort chronologically, so "key < currentWeek" is a valid past test', () => {
  const keys = ['2026-W34', '2026-W09', '2026-W53', '2027-W01', '2026-W01']
  assert.deepEqual([...keys].sort(), ['2026-W01', '2026-W09', '2026-W34', '2026-W53', '2027-W01'])
  // Zero-padding is what makes this work — 'W9' would sort after 'W34'.
  assert.ok('2026-W09' < '2026-W34')
})

test('bounds round-trip: a key maps back to the Monday–Sunday that produced it', () => {
  for (const day of ['2026-08-21', '2027-01-01', '2025-12-31', '2026-03-09']) {
    const key = isoWeekKey(d(day))
    const b = isoWeekBounds(key)
    assert.ok(b, key)
    assert.equal(isoWeekKey(b.start), key, `${key} start`)
    assert.equal(isoWeekKey(b.end), key, `${key} end`)
    assert.equal(b.start.getDay(), 1, 'starts Monday')
    assert.equal(b.end.getDay(), 0, 'ends Sunday')
  }
})

test('bounds reject a malformed or impossible key instead of guessing', () => {
  for (const bad of ['2026-34', '2026-W', 'W34', '', '2026-W00', '2026-W54']) {
    assert.equal(isoWeekBounds(bad), null, bad)
  }
})

test('localDateStr uses local parts — never a UTC shift', () => {
  // 23:30 local would roll to the next day under toISOString() in any +TZ.
  const late = new Date(2026, 7, 21, 23, 30)
  assert.equal(localDateStr(late), '2026-08-21')
})

test('currentIsoWeekKey accepts an injected clock', () => {
  assert.equal(currentIsoWeekKey(d('2026-08-21')), '2026-W34')
})

describe('date-only strings stay on their own day', () => {
  // The reported screen: the range button read "19 авг. — 25 авг." while its own
  // date inputs read 08/20 — 08/26. One range, two answers, because
  // new Date('2026-08-20') is UTC midnight and toLocaleDateString renders it in
  // the browser's zone — the previous day for anyone west of Greenwich.
  it('parses as the local calendar day, not UTC midnight', () => {
    const d = parseLocalDate('2026-08-20')
    assert.equal(d.getFullYear(), 2026)
    assert.equal(d.getMonth(), 7)      // August
    assert.equal(d.getDate(), 20)
    assert.equal(d.getDay(), 4)        // Thursday, in every timezone
  })

  it('round-trips through localDateStr unchanged', () => {
    for (const s of ['2026-01-01', '2026-08-20', '2026-12-31', '2027-03-08']) {
      assert.equal(localDateStr(parseLocalDate(s)), s)
    }
  })

  it('shifts whole days without drifting', () => {
    assert.equal(shiftLocalDate('2026-08-20', 7), '2026-08-27')
    assert.equal(shiftLocalDate('2026-08-20', -7), '2026-08-13')
    assert.equal(shiftLocalDate('2026-03-01', -1), '2026-02-28')
    assert.equal(shiftLocalDate('2026-12-31', 1), '2027-01-01')
  })
})

describe('isCalendarWeek', () => {
  it('accepts a Monday→Sunday pair', () => {
    // 24 Aug 2026 is a Monday.
    assert.equal(isCalendarWeek('2026-08-24', '2026-08-30'), true)
  })

  it('rejects the drifted window the old paging produced', () => {
    // Thu 20 Aug → Wed 26 Aug: seven days, wrong anchor.
    assert.equal(isCalendarWeek('2026-08-20', '2026-08-26'), false)
  })

  it('rejects a Monday that is not seven days long', () => {
    assert.equal(isCalendarWeek('2026-08-24', '2026-08-28'), false)
    assert.equal(isCalendarWeek('2026-08-24', '2026-09-06'), false)
  })
})

describe('paging a week keeps Monday on Monday', () => {
  // What the picker does, in the same order: step the anchor by ±7 and re-derive
  // the week. The old code shifted both ends and then clamped the END to today,
  // which re-anchored the whole window onto whatever weekday it happened to be.
  const page = (from: string, dir: -1 | 1) => {
    const a = parseLocalDate(from)
    a.setDate(a.getDate() + dir * 7)
    return [localDateStr(startOfIsoWeek(a)), localDateStr(endOfIsoWeek(a))]
  }

  it('back and forward land on real weeks', () => {
    assert.deepEqual(page('2026-08-24', -1), ['2026-08-17', '2026-08-23'])
    assert.deepEqual(page('2026-08-17', 1), ['2026-08-24', '2026-08-30'])
  })

  it('returns to where it started after ‹ then ›', () => {
    // THE regression: this round trip is what produced Thu 20 – Wed 26.
    const [back] = page('2026-08-24', -1)
    assert.deepEqual(page(back, 1), ['2026-08-24', '2026-08-30'])
  })

  it('every paged window is still a calendar week, twenty weeks out', () => {
    let from = '2026-08-24'
    for (let i = 0; i < 20; i++) {
      const [f, t] = page(from, -1)
      assert.ok(isCalendarWeek(f, t), `${f} — ${t} is not a Mon–Sun week`)
      assert.equal(parseLocalDate(f).getDay(), 1)
      from = f
    }
  })

  it('crosses a month and a year boundary without drifting', () => {
    assert.deepEqual(page('2026-01-05', -1), ['2025-12-29', '2026-01-04'])
    assert.deepEqual(page('2026-03-02', -1), ['2026-02-23', '2026-03-01'])
  })
})
