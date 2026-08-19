/**
 * Nudge timings, split out from lib/billing/nudge.ts.
 *
 * That module imports the database driver, and the help articles quote these
 * numbers while being reachable from client code. Same split, same reason, as
 * PRICE_NOTICE_DAYS living in ./plans.ts rather than ./price-notice.ts — the
 * build caught that one, and this avoids repeating it.
 */

/**
 * How many days before the end the trial reminder goes out.
 *
 * Three: long enough to connect a store and see what the paid sections actually
 * do before deciding, short enough that it does not arrive while the trial still
 * feels new.
 */
export const TRIAL_REMINDER_DAYS = 3

/**
 * How long before the same nudge may be repeated.
 *
 * Only the outgrew-Free nudge can recur — the others describe a moment that
 * happens once. Thirty days is one turnover window: repeating it more often than
 * the figure itself is recomputed would be noise.
 */
export const RENUDGE_DAYS = 30
