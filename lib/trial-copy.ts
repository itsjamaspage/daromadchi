/**
 * The trial length, ready to drop into a sentence, in all three languages.
 *
 * There is exactly one number — TRIAL_DAYS in lib/billing/features.ts — and it
 * is the same number the code enforces. Every piece of copy that mentions the
 * trial builds on these constants instead of typing a digit, because typing a
 * digit is how the site advertised a 3-day trial for weeks after the code had
 * moved to 14.
 */
import { TRIAL_DAYS } from './billing/features'

/**
 * Russian needs the right case for a day count: 1/21/31 день, 2–4 дня,
 * 5–20 дней. Interpolating blindly prints "14 дня", so the rule lives here —
 * once, rather than in each table that needs it.
 */
export function ruDays(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return 'дней'
  switch (n % 10) {
    case 1: return 'день'
    case 2: case 3: case 4: return 'дня'
    default: return 'дней'
  }
}

/**
 * The bare count, for copy that needs to phrase it itself.
 *
 * Widened to `number` deliberately: TRIAL_DAYS is a literal type, and comparing
 * it against 1 below would otherwise be a compile error today and a silent
 * grammar bug the day the value changes.
 */
export const TRIAL_D: number = TRIAL_DAYS

/** "14 kun" / "14 дней" / "14 days" — the trial length as a noun phrase. */
export const TRIAL_UZ = `${TRIAL_D} kun`
export const TRIAL_RU = `${TRIAL_D} ${ruDays(TRIAL_D)}`
export const TRIAL_EN = `${TRIAL_D} day${TRIAL_D === 1 ? '' : 's'}`
