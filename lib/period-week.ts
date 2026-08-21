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

/** Monday–Sunday of the week BEFORE the one containing `now`. */
export function previousIsoWeekBounds(now: Date = new Date()): { start: Date; end: Date } {
  const start = startOfIsoWeek(now)
  start.setDate(start.getDate() - 7)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}
