/**
 * Business dates in the seller's zone, whoever is looking.
 *
 * Every test runs under THREE process timezones — New York, UTC and Tashkent —
 * because that is the actual deployment: the person running this works from US
 * Eastern, the server is UTC, and the sellers are in Uzbekistan. A helper that
 * is only correct in one of those is the bug, not the fix.
 *
 * Run: npm run test:shop-time
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  SHOP_TZ, shopDateStr, shopMonthStr, shopDayStart, shopDayEnd,
  shiftShopDate, shopWeekday, startOfShopWeek, endOfShopWeek,
  shopDaysBetween, isShopCalendarWeek,
} from './shop-time'

const inTz = (d: Date, tz: string) => d.toLocaleString('sv-SE', { timeZone: tz })

describe('the seller’s calendar day, whoever is looking', () => {
  it('names the same day from New York, UTC and Tashkent', () => {
    // 30 Aug 23:30 US Eastern is already 31 Aug in Tashkent. Every observer must
    // agree that the SELLER's day is the 31st — that is the whole point.
    const instant = new Date('2026-08-30T23:30:00-04:00')
    assert.equal(shopDateStr(instant), '2026-08-31')
    assert.equal(shopMonthStr(instant), '2026-08')
  })

  it('does not shift when the process timezone does', () => {
    // shopDateStr names the zone explicitly, so process.env.TZ is irrelevant.
    // (The suite is run three times over, see package.json — this asserts the
    // property directly as well.)
    const instant = new Date('2026-08-30T23:30:00-04:00')
    assert.equal(shopDateStr(instant), '2026-08-31', `TZ=${process.env.TZ ?? '(unset)'}`)
  })

  it('rolls over at Tashkent midnight, not the viewer’s', () => {
    // 18:59 Eastern = 03:59 next day Tashkent → still the seller's "tomorrow".
    const justBefore = new Date('2026-08-30T18:59:00-04:00')   // 03:59 Tashkent 31st
    const justAfter  = new Date('2026-08-30T15:01:00-04:00')   // 00:01 Tashkent 31st
    assert.equal(shopDateStr(justBefore), '2026-08-31')
    assert.equal(shopDateStr(justAfter), '2026-08-31')
    const stillYesterday = new Date('2026-08-30T14:59:00-04:00') // 23:59 Tashkent 30th
    assert.equal(shopDateStr(stillYesterday), '2026-08-30')
  })
})

describe('a day boundary is the seller’s midnight', () => {
  it('starts at 00:00 and ends at 23:59:59.999 in Tashkent', () => {
    assert.equal(inTz(shopDayStart('2026-08-24'), SHOP_TZ), '2026-08-24 00:00:00')
    assert.equal(inTz(shopDayEnd('2026-08-24'), SHOP_TZ), '2026-08-24 23:59:59')
  })

  it('is the correct INSTANT, which is 19:00 the previous day in UTC', () => {
    // Uzbekistan is UTC+5. This pins the actual moment, not just its rendering —
    // it is what the SQL comparison receives.
    assert.equal(shopDayStart('2026-08-24').toISOString(), '2026-08-23T19:00:00.000Z')
    assert.equal(shopDayEnd('2026-08-24').toISOString(), '2026-08-24T18:59:59.999Z')
  })

  it('covers the whole day with no gap between consecutive days', () => {
    const end = shopDayEnd('2026-08-24').getTime()
    const nextStart = shopDayStart('2026-08-25').getTime()
    assert.equal(end + 1, nextStart)
  })
})

describe('weeks run Monday to Sunday in the seller’s calendar', () => {
  it('finds the Monday and the Sunday', () => {
    assert.equal(startOfShopWeek('2026-08-26'), '2026-08-24')   // a Wednesday
    assert.equal(endOfShopWeek('2026-08-26'), '2026-08-30')
    assert.equal(startOfShopWeek('2026-08-24'), '2026-08-24', 'a Monday is its own start')
    assert.equal(startOfShopWeek('2026-08-30'), '2026-08-24', 'Sunday belongs to the week BEFORE it')
  })

  it('numbers Sunday 7, not 0 — the off-by-one that sends it forward a week', () => {
    assert.equal(shopWeekday('2026-08-24'), 1)
    assert.equal(shopWeekday('2026-08-30'), 7)
  })

  it('counts a week as 7 days inclusive', () => {
    assert.equal(shopDaysBetween('2026-08-24', '2026-08-30'), 7)
    assert.equal(isShopCalendarWeek('2026-08-24', '2026-08-30'), true)
    assert.equal(isShopCalendarWeek('2026-08-25', '2026-08-31'), false, 'Tue–Mon is not a week')
    assert.equal(isShopCalendarWeek('2026-08-24', '2026-08-29'), false, 'six days is not a week')
  })
})

describe('date-string arithmetic cannot drift', () => {
  it('crosses months and years', () => {
    assert.equal(shiftShopDate('2026-08-31', 1), '2026-09-01')
    assert.equal(shiftShopDate('2026-01-01', -1), '2025-12-31')
    assert.equal(shiftShopDate('2026-08-24', 7), '2026-08-31')
    assert.equal(shiftShopDate('2026-08-24', -7), '2026-08-17')
  })

  it('handles a leap day', () => {
    assert.equal(shiftShopDate('2028-02-28', 1), '2028-02-29')
    assert.equal(shiftShopDate('2028-02-29', 1), '2028-03-01')
    assert.equal(shiftShopDate('2026-02-28', 1), '2026-03-01', '2026 is not a leap year')
  })

  it('survives a full year of round trips', () => {
    let d = '2026-01-01'
    for (let i = 0; i < 365; i++) d = shiftShopDate(d, 1)
    assert.equal(d, '2027-01-01')
    for (let i = 0; i < 365; i++) d = shiftShopDate(d, -1)
    assert.equal(d, '2026-01-01')
  })

  it('every day of a year lands in a Mon–Sun week containing it', () => {
    let d = '2026-01-01'
    for (let i = 0; i < 365; i++) {
      const start = startOfShopWeek(d)
      const end = endOfShopWeek(d)
      assert.equal(shopWeekday(start), 1, `${d} → week starts ${start}`)
      assert.equal(shopWeekday(end), 7, `${d} → week ends ${end}`)
      assert.ok(start <= d && d <= end, `${d} is not inside ${start}..${end}`)
      d = shiftShopDate(d, 1)
    }
  })
})
