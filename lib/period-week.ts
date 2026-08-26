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
  const out = new Date(d)
  const day = out.getDay() || 7          // JS Sunday is 0; ISO wants 7
  out.setDate(out.getDate() - (day - 1)) // back up to Monday
  out.setHours(0, 0, 0, 0)
  return out
}

/** Sunday 23:59:59.999 of the week containing `d`, in local time. */
export function endOfIsoWeek(d: Date): Date {
  const out = startOfIsoWeek(d)
  out.setDate(out.getDate() + 6)
  out.setHours(23, 59, 59, 999)
  return out
}

/** `2026-W34` for the ISO week containing `d`. Matches Postgres IYYY-"W"IW. */
export function isoWeekKey(d: Date): string {
  // Work in UTC on the date parts only, so a local DST shift cannot move the
  // day across a boundary mid-calculation.
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)        // the week's Thursday decides the year
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
  const week1Monday = startOfIsoWeek(new Date(year, 0, 4))
  const start = new Date(week1Monday)
  start.setDate(start.getDate() + (week - 1) * 7)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

/** `YYYY-MM-DD` in LOCAL time — never toISOString(), which shifts to UTC. */
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** Move a `YYYY-MM-DD` string by whole days, staying in local time. */
export function shiftLocalDate(s: string, days: number): string {
  const d = parseLocalDate(s)
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

/**
 * Is this range exactly one Monday→Sunday week?
 *
 * Used to decide how the ‹ › buttons page. A calendar week must stay a calendar
 * week: clamping it to "seven days ending today" is what turned Mon–Sun into
 * Thu–Wed after paging forward, and every week after that inherited the drift.
 */
export function isCalendarWeek(from: string, to: string): boolean {
  const start = parseLocalDate(from)
  if (start.getDay() !== 1) return false                 // must begin on a Monday
  return localDateStr(endOfIsoWeek(start)) === to
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
  if (isCalendarWeek(from, to)) {
    const anchor = parseLocalDate(from)
    anchor.setDate(anchor.getDate() + dir * 7)
    return { from: localDateStr(startOfIsoWeek(anchor)), to: localDateStr(endOfIsoWeek(anchor)) }
  }
  // An arbitrary range keeps its own length and its own alignment. Clamping the
  // end to today is fine HERE — there is no weekday anchor to destroy — and it
  // stops a 90-day window from being paged entirely into the future.
  const today = localDateStr(now)
  const rangeDays = Math.round(
    (parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000,
  ) + 1
  let newFrom = shiftLocalDate(from, dir * 7)
  let newTo = shiftLocalDate(to, dir * 7)
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
  if (isCalendarWeek(from, to)) return from < localDateStr(startOfIsoWeek(now))
  return to < localDateStr(now)
}
