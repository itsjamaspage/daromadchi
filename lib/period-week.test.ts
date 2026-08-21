import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isoWeekKey, startOfIsoWeek, endOfIsoWeek, isoWeekBounds, previousIsoWeekBounds, localDateStr, currentIsoWeekKey } from './period-week'

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

test('previous week is the seven days before this one, Monday–Sunday', () => {
  const b = previousIsoWeekBounds(d('2026-08-21'))       // Friday of W34
  assert.equal(localDateStr(b.start), '2026-08-10')      // Monday of W33
  assert.equal(localDateStr(b.end),   '2026-08-16')      // Sunday of W33
  assert.equal(isoWeekKey(b.start), '2026-W33')
  assert.equal(isoWeekKey(b.end),   '2026-W33')
})

test('previous week from a Monday is the week that just ended, not this one', () => {
  // The off-by-one that would show a seller their current week twice.
  const b = previousIsoWeekBounds(d('2026-08-24'))       // Monday, W35 begins
  assert.equal(localDateStr(b.start), '2026-08-17')
  assert.equal(localDateStr(b.end),   '2026-08-23')
})

test('previous week from a Sunday does not swallow that Sunday', () => {
  const b = previousIsoWeekBounds(d('2026-08-23'))       // Sunday, last day of W34
  assert.equal(isoWeekKey(b.start), '2026-W33')
  assert.ok(localDateStr(b.end) < '2026-08-23')
})

test('this week and last week never overlap and leave no gap', () => {
  for (const day of ['2026-08-17', '2026-08-21', '2026-08-23', '2027-01-01', '2025-12-31']) {
    const now = d(day)
    const prev = previousIsoWeekBounds(now)
    const thisMon = startOfIsoWeek(now)
    const gapDays = (thisMon.getTime() - prev.end.getTime()) / 86_400_000
    assert.ok(gapDays > 0 && gapDays < 1, `${day}: last week must end the moment this one starts`)
  }
})

test('previous week crosses the ISO year boundary correctly', () => {
  const b = previousIsoWeekBounds(d('2027-01-05'))       // Tuesday of 2027-W01
  assert.equal(isoWeekKey(b.start), '2026-W53')
})
