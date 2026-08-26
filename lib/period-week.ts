import {
  shopDateStr, shopDayStart, shopDayEnd, shiftShopDate,
  startOfShopWeek, endOfShopWeek, isShopCalendarWeek, shopDaysBetween,
} from './shop-time'
/**
 * ISO week periods for the Заработок page — NO db, NO React. Shared by the
 * server aggregation (lib/db/payouts.ts) and the client view.
 *
 * WEEKS RUN MONDAY→SUNDAY. That is the ISO-8601 definition, it matches the
 * working week a seller in Uzbekistan actually plans around, and — the reason it
 * is worth stating — it is what Postgres already produces. The aggregation keys
 * its buckets with `to_char(ordered_at, 'IYYY-"W"IW')`, so the key format here
 * must agree with that exactly or the SQL buckets and the JS labels describe
 * different weeks.
 *
 * Key format: `2026-W34`. Zero-padded so lexicographic comparison is
 * chronological, which is what makes `key < currentWeekKey()` a valid "is past"
 * test — the same trick the monthly `YYYY-MM` keys relied on.
 *
 * ISO's year rule is the fiddly part and the reason this is a tested module
 * rather than an inline expression: a week belongs to the year containing its
 * THURSDAY. So 1 Jan 2027 (a Friday) is in week 2026-W53, and 31 Dec 2025 (a
 * Wednesday) is in 2026-W01. Naive "day-of-year ÷ 7" arithmetic gets both wrong.
 */

/** Monday 00:00 of the week containing `d`, in local time. */
export function startOfIsoWeek(d: Date): Date {
  return shopDayStart(startOfShopWeek(shopDateStr(d)))
}

/** Sunday 23:59:59.999 of the week containing `d`, in local time. */
export function endOfIsoWeek(d: Date): Date {
  return shopDayEnd(endOfShopWeek(shopDateStr(d)))
}

/** `2026-W34` for the ISO week containing `d`. Matches Postgres IYYY-"W"IW. */
export function isoWeekKey(d: Date): string {
  // The seller's calendar week. This read the PROCESS's date parts, so the same
  // instant produced a different key depending on where the code ran — and once
  // isoWeekBounds started returning Tashkent midnight (19:00 UTC the day
  // before), a US-Eastern process read that Monday as the previous Sunday and
  // keyed the whole week one back.
  //
  // Postgres must agree byte-for-byte: lib/db/payouts.ts buckets with
  // `to_char(… AT TIME ZONE 'Asia/Tashkent', 'IYYY-"W"IW')` for exactly this
  // reason. Change one and you must change the other.
  const dateStr = shopDateStr(d)
  const [y, m, day] = dateStr.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, day))
  const dow = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dow)        // the week's Thursday decides the year
  const year = t.getUTCFullYear()
  const jan1 = Date.UTC(year, 0, 1)
  const week = Math.ceil(((t.getTime() - jan1) / 86_400_000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** The ISO week key for today. */
export function currentIsoWeekKey(now: Date = new Date()): string {
  return isoWeekKey(now)
}

/**
 * Monday and Sunday of a `2026-W34` key.
 *
 * Derived by walking from 4 January — a date ISO guarantees is in week 1 of its
 * year — rather than from 1 January, which may belong to the previous year's
 * last week.
 */
export function isoWeekBounds(key: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(key)
  if (!m) return null
  const year = Number(m[1]), week = Number(m[2])
  if (week < 1 || week > 53) return null
  // All of this on date STRINGS, converting to instants only at the end. It used
  // to take a Date from startOfIsoWeek and then call setDate()/setHours() on it,
  // which operate in the PROCESS's zone — so once startOfIsoWeek returned the
  // seller's midnight, every subsequent step nudged it off that boundary.
  //
  // 4 January is the date ISO-8601 guarantees is in week 1 of its year; 1 January
  // may belong to the previous year's last week.
  const week1Monday = startOfShopWeek(`${m[1]}-01-04`)
  const startStr = shiftShopDate(week1Monday, (week - 1) * 7)
  return { start: shopDayStart(startStr), end: shopDayEnd(shiftShopDate(startStr, 6)) }
}

/**
 * `YYYY-MM-DD` in the SELLER's zone — see lib/shop-time.ts.
 *
 * The name says "local" for historical reasons and the call sites are unchanged,
 * but the meaning is now explicit rather than ambient: it no longer depends on
 * where the browser or the server happens to be. A person running this from US
 * Eastern, a server in UTC and a seller in Tashkent can sit on three different
 * calendar days at once, and every one of them needs the seller's answer.
 */
export function localDateStr(d: Date): string {
  return shopDateStr(d)
}

/**
 * Parse `YYYY-MM-DD` as a LOCAL calendar date.
 *
 * `new Date('2026-08-20')` is defined to parse as UTC midnight, so rendering it
 * with toLocaleDateString anywhere west of Greenwich prints the day BEFORE. That
 * is why the dashboard's range button read "19 авг. — 25 авг." while its own date
 * inputs said 08/20 — 08/26: same range, two answers. Date-only strings carry no
 * timezone and must not acquire one on the way in.
 */
/** The instant of midnight on `s` in the SELLER's zone. */
export function parseLocalDate(s: string): Date {
  return shopDayStart(s)
}

/** Move a `YYYY-MM-DD` string by whole days, staying in local time. */
/** Add days to a `YYYY-MM-DD` string. Zone-free string arithmetic. */
export function shiftLocalDate(s: string, days: number): string {
  return shiftShopDate(s, days)
}

/**
 * Is this range exactly one Monday→Sunday week?
 *
 * Used to decide how the ‹ › buttons page. A calendar week must stay a calendar
 * week: clamping it to "seven days ending today" is what turned Mon–Sun into
 * Thu–Wed after paging forward, and every week after that inherited the drift.
 */
export function isCalendarWeek(from: string, to: string): boolean {
  // Pure string arithmetic. This used to parse `from` to a Date and call
  // getDay() on it — which asks the PROCESS what weekday it is. Once
  // parseLocalDate started returning the seller's midnight (19:00 UTC the day
  // before), getDay() in a US-Eastern browser read that Monday as a Sunday and
  // the picker stopped recognising its own week.
  return isShopCalendarWeek(from, to)
}

/**
 * Page a date range forward or back by one step, and the rule for when paging
 * forward should stop.
 *
 * ── Why this lives here and not in the picker ───────────────────────────────
 * It was written twice — once in DateRangePicker, once in CalendarPicker — and
 * the two drifted, which is the whole reason this module exists. #365 fixed the
 * copy in DateRangePicker and left the one in CalendarPicker untouched, so the
 * P&L page kept the original bug: paging back a week and forward again returned
 * Thu 20 – Wed 26 instead of Mon 24 – Sun 30, and every page after that
 * inherited the drift. A third copy would fail the same way. There is one now.
 *
 * ── The bug it fixes, precisely ────────────────────────────────────────────
 * The old code shifted both ends by 7 days and then clamped the END to today:
 *
 *     if (newTo > today) { newTo = today; newFrom = today − (rangeDays − 1) }
 *
 * On a Wednesday, that re-anchors the window to Thu–Wed. It is only ever
 * reached when the window has caught up with the present — which is exactly
 * when the user is looking at the current week — so the drift lands on the most
 * visited view, not an edge case.
 *
 * A calendar week must therefore page as a WEEK, not as "seven days": snap the
 * shifted anchor back to its Monday. The window is then allowed to run to its
 * Sunday even though that Sunday is in the future, because a week that ends on
 * Wednesday is not a week.
 */
export function pageRange(
  from: string,
  to: string,
  dir: -1 | 1,
  now: Date = new Date(),
): { from: string; to: string } {
  if (isShopCalendarWeek(from, to)) {
    const anchor = shiftShopDate(from, dir * 7)
    return { from: startOfShopWeek(anchor), to: endOfShopWeek(anchor) }
  }
  // An arbitrary range keeps its own length and its own alignment. Clamping the
  // end to today is fine HERE — there is no weekday anchor to destroy — and it
  // stops a 90-day window from being paged entirely into the future.
  const today = shopDateStr(now)
  const rangeDays = shopDaysBetween(from, to)
  let newFrom = shiftShopDate(from, dir * 7)
  let newTo = shiftShopDate(to, dir * 7)
  if (newTo > today) {
    newTo = today
    newFrom = shiftLocalDate(today, -(rangeDays - 1))
  }
  return { from: newFrom, to: newTo }
}

/**
 * Whether the "next" button should be live.
 *
 * For a calendar week the test is on the START, not the end: this week's Sunday
 * is legitimately in the future, so an end-based test would disable the button
 * while you were still a week behind — and, worse, the old end-based test is
 * what let the clamp above fire in the first place.
 */
export function canPageForward(from: string, to: string, now: Date = new Date()): boolean {
  if (isShopCalendarWeek(from, to)) return from < shopWeekBounds(now).from
  return to < shopDateStr(now)
}

/**
 * Add (or subtract) whole months, clamping the day to the target month.
 *
 * JavaScript's `setMonth` rolls an overflowing day FORWARD into the next month,
 * which is almost never what a caller means:
 *
 *   31 Jan + 1 month → 31 Feb → 3 March      (not 28 Feb)
 *   31 May − 1 month → 31 April → 1 May      (not 30 April)
 *
 * Both shapes shipped here. In billing it made a subscription bought on the 31st
 * expire a few days late, and because each renewal is computed from the previous
 * end date, the drift compounds. In the analytics windows it was worse than late
 * — `new Date(); d.setMonth(d.getMonth() - i)` run on the 31st produced a series
 * with two months DUPLICATED and two MISSING, so the coefficient of variation
 * driving reorder advice was computed over a month list that was simply wrong,
 * once a month, for three days.
 *
 * Clamping is the convention every billing system uses: the 31st of a month
 * followed by a 30-day month lands on the 30th, not on the 1st of the month
 * after.
 */
export function addMonths(d: Date, months: number): Date {
  const day = d.getDate()
  // Day 1 first, so setMonth can never overflow; then put the day back, capped
  // at however many days the destination month actually has.
  const out = new Date(d)
  out.setDate(1)
  out.setMonth(out.getMonth() + months)
  const daysInTarget = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate()
  out.setDate(Math.min(day, daysInTarget))
  return out
}

/** Midnight on the 1st of `d`'s month, in LOCAL time. */
export function startOfMonth(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), 1)
  out.setHours(0, 0, 0, 0)
  return out
}

/**
 * `YYYY-MM` in LOCAL time — never toISOString(), which shifts to UTC.
 *
 * The same trap localDateStr exists for, one unit up: for a seller at UTC+5, an
 * order placed at 01:00 on 1 September is 20:00 on 31 August in UTC, so
 * `toISOString().slice(0, 7)` files it under the wrong MONTH. That mattered here
 * because the month keys were built from local dates while the buckets were
 * keyed from UTC ones — so around a month boundary the series was looking up
 * keys that could not match.
 */
export function localMonthStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Local 23:59:59.999 on the same calendar day.
 *
 * The companion to parseLocalDate, and the pair exists because mixing them was
 * a real bug: lib/db/revenue.ts had `new Date(from)` (UTC midnight) for the
 * start and `new Date(to + 'T23:59:59')` (local) for the end, in one function.
 *
 * `new Date('2026-08-24')` is parsed as UTC midnight by the spec — a
 * date-ONLY string is UTC, while a date-time string without a zone is local.
 * For a seller in Tashkent (UTC+5) that made every window on the dashboard
 * begin at 05:00, so the first five hours of the selected period were missing
 * from the KPI cards, the chart, the product table and the orders list alike.
 */
export function endOfLocalDay(d: Date): Date {
  return shopDayEnd(shopDateStr(d))
}

/** 23:59:59.999 on a `YYYY-MM-DD` string, in the seller's zone. */
export function parseLocalDateEnd(s: string): Date {
  return shopDayEnd(s)
}

/** Local midnight → local end-of-day for a `YYYY-MM-DD` string, in one step. */
export function localDayRange(dateStr: string): { start: Date; end: Date } {
  const start = parseLocalDate(dateStr)
  return { start, end: endOfLocalDay(start) }
}

/**
 * The seller's current week, as `YYYY-MM-DD` strings.
 *
 * A convenience over startOfShopWeek/endOfShopWeek for the common case: what
 * week is the seller in right now. (An earlier draft of this comment said
 * startOfIsoWeek/endOfIsoWeek stayed process-local — they did not survive that
 * way. Mixing a shop instant with process-local accessors turned out to be the
 * bug, so those are shop-zone too, and isoWeekKey carries the matching
 * AT TIME ZONE cast in lib/db/payouts.ts.) See lib/shop-time.ts.
 */
export function shopWeekBounds(now: Date = new Date()): { from: string; to: string } {
  const today = shopDateStr(now)
  return { from: startOfShopWeek(today), to: endOfShopWeek(today) }
}
