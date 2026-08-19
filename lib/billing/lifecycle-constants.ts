/**
 * Account lifecycle timings.
 *
 * Separate from the sweep (lib/billing/lifecycle.ts) because the privacy policy
 * and terms quote these numbers and are client components — the same split
 * PRICE_NOTICE_DAYS and the nudge timings needed. The policy therefore states
 * the periods the code actually enforces, which is the point: for the
 * Personalization Agency registration (№322191225) the deletion basis has to be
 * on record, not only in the source.
 *
 * The ladder is deliberately long and every step is reversible until the last:
 *
 *   day 365  no sign-in for a year  -> warning
 *   day 395  still nothing          -> FROZEN. Nothing is deleted; one click
 *                                      restores the account in full.
 *   day 485  still nothing          -> eligible for deletion
 *
 * A year of silence before the first email, and nearly four months of frozen-
 * but-intact after it. Anyone who comes back at any point before the end loses
 * nothing.
 */

/** Days without a sign-in before the first warning. */
export const INACTIVE_WARN_DAYS = 365

/** Days after that warning before the account is frozen. */
export const FREEZE_AFTER_WARN_DAYS = 30

/** Days frozen before the account becomes eligible for deletion. */
export const DELETE_AFTER_FREEZE_DAYS = 90

/** Total silence before deletion is even considered. */
export const TOTAL_DAYS_BEFORE_DELETE =
  INACTIVE_WARN_DAYS + FREEZE_AFTER_WARN_DAYS + DELETE_AFTER_FREEZE_DAYS
