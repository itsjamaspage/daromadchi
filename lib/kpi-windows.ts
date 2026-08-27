import { shopDateStr, shopDayStart, shopDayEnd, shiftShopDate, shopDaysBetween } from '@/lib/shop-time'

/**
 * The two windows behind the % badges on the dashboard KPI cards: the period
 * being shown, and the period it is compared against.
 *
 * Pure and DB-free so the arithmetic can be tested directly — it was inline in
 * lib/db/kpis.ts, where the only way to exercise it was to run a query.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 * The baseline is the SAME LENGTH, IMMEDIATELY BEFORE. For the dashboard's
 * default view — the current Mon–Sun week — that is exactly last week, which is
 * what the badge is meant to say. For a 30-day view it is the previous 30 days.
 * The comparison stays meaningful at every zoom level rather than pinning a
 * year's revenue against one week.
 *
 * ── The bug this replaces ───────────────────────────────────────────────────
 * `new Date('2026-08-24')` parses as UTC midnight, not local. For a seller in
 * Tashkent (UTC+5) the shown week therefore began at 05:00 on Monday — the
 * first five hours missing — and the baseline, derived from it by millisecond
 * arithmetic, ran Mon 17 Aug 10:00 → Mon 24 Aug 04:59. Ten hours out at the
 * start AND overlapping into the week it was supposed to be compared against.
 *
 * So the previous window is derived by shifting the DATES back a whole number of
 * days, not by subtracting milliseconds. A week shifted seven days is the
 * previous week, exactly, with no boundary left over.
 */
export interface KpiWindows {
  since: Date | null
  until: Date | null
  prevSince: Date | null
  prevUntil: Date | null
}

/** Inclusive day count: Mon→Sun is 7, not 6. */
export const inclusiveDays = shopDaysBetween

export function kpiWindows(opts: {
  from?: string
  to?: string
  days?: number
  now?: Date
}): KpiWindows {
  const now = opts.now ?? new Date()

  if (opts.from && opts.to) {
    const span = inclusiveDays(opts.from, opts.to)
    return {
      since:     shopDayStart(opts.from),
      until:     shopDayEnd(opts.to),
      prevSince: shopDayStart(shiftShopDate(opts.from, -span)),
      prevUntil: shopDayEnd(shiftShopDate(opts.to, -span)),
    }
  }

  if (opts.days && opts.days > 0) {
    // A preset is "the last N days ending today", anchored to local midnight
    // rather than to the current time of day — otherwise the first day of the
    // window is a partial one whose length depends on when the page was opened,
    // and the baseline inherits that.
    const today = shopDateStr(now)
    const fromStr = shiftShopDate(today, -(opts.days - 1))
    return {
      since:     shopDayStart(fromStr),
      until:     shopDayEnd(today),
      prevSince: shopDayStart(shiftShopDate(fromStr, -opts.days)),
      // Ends the day BEFORE the current window starts. The old code ended it
      // exactly AT the start instant, so the boundary moment fell in both.
      prevUntil: shopDayEnd(shiftShopDate(fromStr, -1)),
    }
  }

  return { since: null, until: null, prevSince: null, prevUntil: null }
}
