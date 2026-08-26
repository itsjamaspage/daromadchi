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
