/**
 * Business dates belong to the SELLER's timezone, not to whoever is looking.
 *
 * Daromadchi's sellers are in Uzbekistan. The people running it are not always:
 * a browser in New York, a server in UTC and a seller in Tashkent can be on
 * three different calendar days at the same instant —
 *
 *   the same moment, 30 Aug 23:30 US Eastern
 *     browser  America/New_York : 2026-08-30 23:30 (Sun)   ← picker says last week
 *     server   UTC              : 2026-08-31 03:30 (Mon)   ← query says this week
 *     seller   Asia/Tashkent    : 2026-08-31 08:30 (Mon)   ← eight hours into Monday
 *
 * — so "today" and "this week" disagreed depending on which side of the wire
 * computed them. Setting TZ on the server fixes server-vs-seller and makes
 * browser-vs-server worse. The only thing that works is naming the zone
 * explicitly, on both sides, and never using "local" for a business date.
 *
 * ── How the arithmetic avoids the usual traps ───────────────────────────────
 *
 * Calendar maths is done on `YYYY-MM-DD` STRINGS, which carry no offset and so
 * cannot drift. A zone is applied only at the two edges: reading what day it is
 * now, and turning a date into the instant a query compares against. That keeps
 * the tricky part in two small functions instead of spread across every caller.
 *
 * The offset is derived from the zone database via Intl rather than hardcoded to
 * +05:00. Uzbekistan has had no DST since 1996 and the constant would be correct
 * today, but a hardcoded offset is a silent wrong answer if that ever changes,
 * and deriving it costs nothing.
 */

export const SHOP_TZ = 'Asia/Tashkent'

/** The zone's UTC offset in ms at a given instant. */
function offsetAt(utcMs: number, tz: string): number {
  // Intl formats to whole seconds, so the offset must be measured between two
  // whole-second values. Comparing a second-precision reconstruction against an
  // input carrying milliseconds made the offset short by exactly those
  // milliseconds — which turned 23:59:59.999 into 00:00:00.997 the next day.
  const whole = Math.floor(utcMs / 1000) * 1000
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(whole))
  const p: Record<string, string> = {}
  for (const { type, value } of parts) p[type] = value
  // Intl renders midnight as hour 24 in some engines; normalise.
  const asIfUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour) % 24, Number(p.minute), Number(p.second),
  )
  return asIfUtc - whole
}

/** The instant at which the given wall-clock time occurs in `tz`. */
function zonedToInstant(
  y: number, mo: number, d: number, h: number, mi: number, s: number, ms: number, tz: string,
): Date {
  const guess = Date.UTC(y, mo, d, h, mi, s, ms)
  // Two passes: the first offset is looked up at the wrong instant by exactly
  // the offset, which matters only at a DST boundary — but costs nothing here
  // and keeps the function correct for any zone, not just this one.
  const first = guess - offsetAt(guess, tz)
  return new Date(guess - offsetAt(first, tz))
}

/** `YYYY-MM-DD` for an instant, as the SELLER's calendar sees it. */
export function shopDateStr(d: Date = new Date()): string {
  // 'en-CA' formats as YYYY-MM-DD, and unlike 'sv-SE' it is unambiguous about it.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/** `YYYY-MM` for an instant, as the seller's calendar sees it. */
export function shopMonthStr(d: Date = new Date()): string {
  return shopDateStr(d).slice(0, 7)
}

/** The instant of 00:00:00.000 on `dateStr` in the seller's zone. */
export function shopDayStart(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return zonedToInstant(y, m - 1, d, 0, 0, 0, 0, SHOP_TZ)
}

/** The instant of 23:59:59.999 on `dateStr` in the seller's zone. */
export function shopDayEnd(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return zonedToInstant(y, m - 1, d, 23, 59, 59, 999, SHOP_TZ)
}

// ── Calendar maths on date strings — no zone involved, so nothing can drift ──

/** A stable anchor for a date string: UTC noon, far from any offset boundary. */
function anchor(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

function fromAnchor(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** Add days to a `YYYY-MM-DD` string. */
export function shiftShopDate(dateStr: string, days: number): string {
  const a = anchor(dateStr)
  a.setUTCDate(a.getUTCDate() + days)
  return fromAnchor(a)
}

/** 1 = Monday … 7 = Sunday, ISO numbering. */
export function shopWeekday(dateStr: string): number {
  return anchor(dateStr).getUTCDay() || 7
}

/** The Monday of `dateStr`'s week, as a date string. */
export function startOfShopWeek(dateStr: string): string {
  return shiftShopDate(dateStr, -(shopWeekday(dateStr) - 1))
}

/** The Sunday of `dateStr`'s week, as a date string. */
export function endOfShopWeek(dateStr: string): string {
  return shiftShopDate(startOfShopWeek(dateStr), 6)
}

/** Inclusive day count between two date strings: Mon→Sun is 7. */
export function shopDaysBetween(from: string, to: string): number {
  return Math.round((anchor(to).getTime() - anchor(from).getTime()) / 86_400_000) + 1
}

/** True when `from`–`to` is exactly one Monday→Sunday week. */
export function isShopCalendarWeek(from: string, to: string): boolean {
  return shopWeekday(from) === 1 && shopDaysBetween(from, to) === 7
}
