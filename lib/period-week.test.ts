import { test, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { shopWeekday } from './shop-time'
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
    // Weekday of the INSTANT as the seller sees it, not as the process does.
    assert.equal(shopWeekday(localDateStr(b.start)), 1, 'starts Monday')
    assert.equal(shopWeekday(localDateStr(b.end)), 7, 'ends Sunday')
  }
})

test('bounds reject a malformed or impossible key instead of guessing', () => {
  for (const bad of ['2026-34', '2026-W', 'W34', '', '2026-W00', '2026-W54']) {
    assert.equal(isoWeekBounds(bad), null, bad)
  }
})

test('localDateStr names the SELLER\'s day, not the viewer\'s', () => {
  // The contract changed with lib/shop-time.ts. It used to mean "the process's
  // calendar day"; it now means Tashkent's, whoever is asking — because a
  // browser in New York, a server in UTC and a seller in Uzbekistan are
  // routinely on three different days at the same instant.
  //
  // 21:00 UTC on the 21st is already 02:00 on the 22nd for the seller.
  assert.equal(localDateStr(new Date('2026-08-21T21:00:00Z')), '2026-08-22')
  // 18:00 UTC is 23:00 the same day there.
  assert.equal(localDateStr(new Date('2026-08-21T18:00:00Z')), '2026-08-21')
  // And the boundary itself: 19:00 UTC is Tashkent midnight.
  assert.equal(localDateStr(new Date('2026-08-21T18:59:59Z')), '2026-08-21')
  assert.equal(localDateStr(new Date('2026-08-21T19:00:00Z')), '2026-08-22')
})

test('currentIsoWeekKey accepts an injected clock', () => {
  assert.equal(currentIsoWeekKey(d('2026-08-21')), '2026-W34')
})

describe('date-only strings stay on their own day', () => {
  // The reported screen: the range button read "19 авг. — 25 авг." while its own
  // date inputs read 08/20 — 08/26. One range, two answers, because
  // new Date('2026-08-20') is UTC midnight and toLocaleDateString renders it in
  // the browser's zone — the previous day for anyone west of Greenwich.
  it('parses to the SELLER\'s midnight, in every timezone', () => {
    // Asserting the instant rather than its process-local parts: those parts
    // differ by design in New York, which is the whole point of naming the zone.
    assert.equal(parseLocalDate('2026-08-20').toISOString(), '2026-08-19T19:00:00.000Z')
    assert.equal(shopWeekday('2026-08-20'), 4, 'Thursday, for everyone')
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
      assert.equal(shopWeekday(f), 1)
      from = f
    }
  })

  it('crosses a month and a year boundary without drifting', () => {
    assert.deepEqual(page('2026-01-05', -1), ['2025-12-29', '2026-01-04'])
    assert.deepEqual(page('2026-03-02', -1), ['2026-02-23', '2026-03-01'])
  })
})

// ── Paging a week (the bug the P&L page shipped with) ───────────────────────
//
// Reported from the live site: "when i am changing to last week and back to
// current week, the date ranger / calendar is breaking again". These reproduce
// the exact sequence and the exact wrong ranges from the screenshots.

import { pageRange, canPageForward } from './period-week'

const WED_26_AUG_2026 = new Date(2026, 7, 26)   // month is 0-based
// The seller's weekday for a date STRING. Was parseLocalDate(s).getDay(), which
// asks the PROCESS — and parseLocalDate now returns Tashkent midnight, i.e.
// 19:00 the previous day in UTC, which a New York process reads as Sunday.
const dow = (s: string) => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][shopWeekday(s) - 1]

test('paging back then forward returns to the SAME Mon–Sun week', () => {
  const week = { from: '2026-08-24', to: '2026-08-30' }
  const back = pageRange(week.from, week.to, -1, WED_26_AUG_2026)
  assert.deepEqual(back, { from: '2026-08-17', to: '2026-08-23' })

  const forward = pageRange(back.from, back.to, 1, WED_26_AUG_2026)
  // This is the assertion that failed before: it returned 2026-08-20 (Thu),
  // because the old clamp re-anchored the window to "the 7 days ending today".
  assert.deepEqual(forward, week, 'forward from last week must land back on Mon 24 – Sun 30')
})

test('a week never pages into a Thu–Wed window, however far you page', () => {
  // Walk back six weeks and forward again, checking every stop. The old bug
  // only needed one round trip to appear, but it also COMPOUNDED — each
  // subsequent page inherited the drift — so this walks far enough to catch that.
  let r = { from: '2026-08-24', to: '2026-08-30' }
  for (let i = 0; i < 6; i++) {
    r = pageRange(r.from, r.to, -1, WED_26_AUG_2026)
    assert.equal(dow(r.from), 'Mon', `page ${-i - 1}: ${r.from} is a ${dow(r.from)}`)
    assert.equal(dow(r.to), 'Sun', `page ${-i - 1}: ${r.to} is a ${dow(r.to)}`)
  }
  for (let i = 0; i < 6; i++) {
    r = pageRange(r.from, r.to, 1, WED_26_AUG_2026)
    assert.equal(dow(r.from), 'Mon', `returning, page ${i + 1}: ${r.from} is a ${dow(r.from)}`)
    assert.equal(dow(r.to), 'Sun', `returning, page ${i + 1}: ${r.to} is a ${dow(r.to)}`)
  }
  assert.deepEqual(r, { from: '2026-08-24', to: '2026-08-30' }, 'six back and six forward is a round trip')
})

test('the current week keeps its Sunday even though Sunday is in the future', () => {
  // Today is Wednesday. The week must still read Mon 24 – Sun 30; truncating it
  // at today is precisely what produced the Thu–Wed range on screen.
  const r = pageRange('2026-08-17', '2026-08-23', 1, WED_26_AUG_2026)
  assert.equal(r.to, '2026-08-30')
  assert.ok(r.to > localDateStr(WED_26_AUG_2026), 'the end is allowed to be in the future')
})

test('"next" is decided by the week you are ON, not by its Sunday', () => {
  // On the current week → nothing further to go to.
  assert.equal(canPageForward('2026-08-24', '2026-08-30', WED_26_AUG_2026), false)
  // On last week → the button must be live, even though its end (23rd) is past.
  assert.equal(canPageForward('2026-08-17', '2026-08-23', WED_26_AUG_2026), true)
})

test('a non-week range keeps its own length and is still clamped', () => {
  // A 30-day window has no weekday anchor to protect, so the old clamp is
  // correct for it — and must not be lost while fixing the week case.
  const r = pageRange('2026-07-01', '2026-07-30', 1, WED_26_AUG_2026)
  assert.deepEqual(r, { from: '2026-07-08', to: '2026-08-06' }, 'both ends move by exactly 7 days')
  assert.equal(
    Math.round((parseLocalDate(r.to).getTime() - parseLocalDate(r.from).getTime()) / 86_400_000) + 1,
    30, 'length preserved',
  )
  const atEdge = pageRange('2026-08-01', '2026-08-25', 1, WED_26_AUG_2026)
  assert.equal(atEdge.to, '2026-08-26', 'clamped to today rather than paged into the future')
})

// ── Month arithmetic ────────────────────────────────────────────────────────
//
// setMonth rolls an overflowing day forward. These pin the two shapes that
// shipped: a billing period ending late, and an analytics month series with
// months duplicated and dropped.

import { addMonths, startOfMonth, localMonthStr } from './period-week'

const ymd = (d: Date) => localDateStr(d)

test('a month-end date clamps instead of rolling into the next month', () => {
  // The exact cases from the audit, with the old behaviour named.
  assert.equal(ymd(addMonths(new Date(2026, 0, 31), 1)), '2026-02-28', 'setMonth gave 2026-03-03')
  assert.equal(ymd(addMonths(new Date(2026, 2, 31), 1)), '2026-04-30', 'setMonth gave 2026-05-01')
  assert.equal(ymd(addMonths(new Date(2026, 4, 31), -1)), '2026-04-30', 'setMonth gave 2026-05-01')
  assert.equal(ymd(addMonths(new Date(2026, 7, 31), 1)), '2026-09-30', 'setMonth gave 2026-10-01')
})

test('a leap year is respected', () => {
  assert.equal(ymd(addMonths(new Date(2028, 0, 31), 1)), '2028-02-29', '2028 is a leap year')
  assert.equal(ymd(addMonths(new Date(2026, 0, 31), 1)), '2026-02-28', '2026 is not')
})

test('a day that fits is left exactly where it is', () => {
  assert.equal(ymd(addMonths(new Date(2026, 0, 15), 1)), '2026-02-15')
  assert.equal(ymd(addMonths(new Date(2026, 0, 15), -1)), '2025-12-15')
  assert.equal(ymd(addMonths(new Date(2026, 0, 15), 0)), '2026-01-15')
})

test('it crosses years in both directions', () => {
  assert.equal(ymd(addMonths(new Date(2026, 11, 15), 1)), '2027-01-15')
  assert.equal(ymd(addMonths(new Date(2026, 0, 15), -1)), '2025-12-15')
  assert.equal(ymd(addMonths(new Date(2026, 5, 30), 12)), '2027-06-30')
})

test('it does not mutate its argument', () => {
  const d = new Date(2026, 0, 31)
  addMonths(d, 1)
  assert.equal(ymd(d), '2026-01-31')
})

test('a month series has no duplicates and no gaps, run on the 31st', () => {
  // The reported failure: on 31 Aug 2026 the 6-month window produced
  // [Mar, May, May, Jul, Jul, Aug] — April and June missing entirely.
  const on31st = new Date(2026, 7, 31)
  const keys: string[] = []
  for (let i = 5; i >= 0; i--) keys.push(localMonthStr(addMonths(on31st, -i)))
  assert.deepEqual(keys, ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'])
  assert.equal(new Set(keys).size, keys.length, 'every bucket is distinct')
})

test('every day of every month produces a clean 12-month series', () => {
  // The bug only appeared on the 29th–31st, which is how it survived: any test
  // written on a normal day passes. This walks a whole year of start dates.
  for (let m = 0; m < 12; m++) {
    for (let day = 28; day <= 31; day++) {
      const start = new Date(2026, m, 1)
      const dim = new Date(2026, m + 1, 0).getDate()
      if (day > dim) continue
      start.setDate(day)
      const keys = Array.from({ length: 12 }, (_, i) => localMonthStr(addMonths(start, -(11 - i))))
      assert.equal(new Set(keys).size, 12, `duplicate month starting ${ymd(start)}: ${keys.join(',')}`)
    }
  }
})

test('startOfMonth is local midnight on the 1st', () => {
  const d = startOfMonth(new Date(2026, 7, 31, 23, 45))
  assert.equal(ymd(d), '2026-08-01')
  assert.equal(d.getHours(), 0)
})

test('localMonthStr uses the local month, not the UTC one', () => {
  // Same trap as localDateStr, one unit up: east of Greenwich, local midnight on
  // the 1st is still the previous month in UTC.
  const firstOfMonthLocal = new Date(2026, 8, 1, 1, 0)
  assert.equal(localMonthStr(firstOfMonthLocal), '2026-09')
})
