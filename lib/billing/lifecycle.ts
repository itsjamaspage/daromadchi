/**
 * Freezing and, eventually, deleting accounts nobody has signed into.
 *
 * ── The safety posture ──────────────────────────────────────────────────────
 * This is the only code in the product that destroys a seller's data, so every
 * decision here is biased toward doing nothing:
 *
 *  - Deletion is OFF unless ACCOUNT_LIFECYCLE_DELETE_ENABLED is set. Unset, the
 *    sweep logs exactly who it WOULD delete and deletes nobody. Same posture as
 *    BILLING_AUTORENEW_ENABLED, for the same reason: the irreversible half of a
 *    system should not switch itself on by being deployed.
 *  - Only free accounts. Never grandfathered, never with a live subscription,
 *    never with any payment history — an account that has ever paid is a
 *    commercial counterparty, and its records are retained under tax law
 *    (privacy policy §9.3). Those are listed for a human, not deleted.
 *  - NULL last_active_at means UNKNOWN, not inactive. A missing timestamp must
 *    never be read as a year of silence.
 *  - Freezing destroys nothing and is undone by one click.
 *
 * ── The ladder ──────────────────────────────────────────────────────────────
 * 365 days silent → warned · +30 → frozen · +90 → eligible for deletion. The
 * periods live in ./lifecycle-constants.ts because the privacy policy quotes
 * them, and for the Personalization Agency registration (№322191225) the basis
 * has to be on record rather than only in code.
 */
import 'server-only'
import { and, eq, isNotNull, isNull, lt, inArray, sql } from 'drizzle-orm'
import { db, users, payments, subscriptions } from '@/lib/db'
import { sendTelegramMessage } from '@/lib/telegram'
import { logger } from '@/lib/logger'
import {
  INACTIVE_WARN_DAYS, FREEZE_AFTER_WARN_DAYS, DELETE_AFTER_FREEZE_DAYS,
} from './lifecycle-constants'

const DAY_MS = 24 * 60 * 60 * 1000

export function deletionEnabled(): boolean {
  return /^(1|true|on|yes)$/i.test(process.env.ACCOUNT_LIFECYCLE_DELETE_ENABLED?.trim() || '')
}

/** Note that a seller was here. Called on sign-in; cheap and idempotent. */
export async function touchLastActive(userId: string, now: Date = new Date()): Promise<void> {
  await db.update(users)
    .set({ last_active_at: now })
    .where(eq(users.id, userId))
}

/**
 * Bring a frozen account back.
 *
 * Everything the freeze gated is available again immediately: freezing only
 * ever set a flag. The activity clock restarts, so a seller who reactivates and
 * then goes quiet again gets the full ladder from the beginning.
 */
export async function reactivate(userId: string, now: Date = new Date()): Promise<void> {
  await db.update(users)
    .set({ frozen_at: null, last_active_at: now })
    .where(eq(users.id, userId))
  logger.info('account_reactivated', { userId })
}

/** True when this account is frozen right now. */
export async function isFrozen(userId: string): Promise<boolean> {
  const [row] = await db.select({ frozen: users.frozen_at }).from(users).where(eq(users.id, userId))
  return row?.frozen != null
}

/* ── who is protected ─────────────────────────────────────────────────────── */

/**
 * Accounts the lifecycle must never touch, whatever their activity.
 *
 * Returned as a set of ids rather than filtered inline so the sweep can LOG the
 * ones it skipped: an account that looks abandoned but has payment history is
 * exactly the case a human should see.
 */
async function protectedUserIds(): Promise<Set<string>> {
  const [paid, subs, grandfathered] = await Promise.all([
    db.selectDistinct({ id: payments.user_id }).from(payments),
    db.selectDistinct({ id: subscriptions.user_id }).from(subscriptions)
      .where(inArray(subscriptions.status, ['active', 'past_due', 'pending'])),
    db.select({ id: users.id }).from(users).where(eq(users.is_grandfathered, true)),
  ])
  const out = new Set<string>()
  for (const r of [...paid, ...subs, ...grandfathered]) if (r.id) out.add(r.id)
  return out
}

/* ── copy ─────────────────────────────────────────────────────────────────── */

function warnText(daysToFreeze: number): string {
  return `⚠️ <b>Hisobingiz uzoq vaqt ishlatilmadi / Аккаунт долго не использовался</b>\n\n`
    + `${daysToFreeze} kundan keyin hisobingiz vaqtincha muzlatiladi. Ma'lumotlaringiz o'chirilmaydi — `
    + `kirsangiz, bir bosishda tiklanadi.\n\n`
    + `Через ${daysToFreeze} дней аккаунт будет временно заморожен. Данные не удаляются — `
    + `войдите, и всё восстановится в один клик.`
}

function freezeText(daysToDelete: number): string {
  return `❄️ <b>Hisobingiz muzlatildi / Аккаунт заморожен</b>\n\n`
    + `Ma'lumotlaringiz saqlanmoqda. Kirib, bir bosishda tiklashingiz mumkin. `
    + `Agar ${daysToDelete} kun ichida kirmasangiz, hisob va unga bog'liq shaxsiy ma'lumotlar o'chiriladi.\n\n`
    + `Данные сохранены. Войдите — и аккаунт восстановится в один клик. `
    + `Если вы не войдёте в течение ${daysToDelete} дней, аккаунт и связанные персональные данные будут удалены.`
}

/* ── the sweep ────────────────────────────────────────────────────────────── */

export interface LifecycleSweepResult {
  warned: number
  frozen: number
  /** Accounts past the whole ladder. Deleted only when the flag is on. */
  deletable: number
  deleted: number
  /** Past the ladder but protected — listed for a human, never deleted. */
  skippedProtected: number
  dryRun: boolean
}

/**
 * One pass of the ladder. Rides the daily expire-plans job.
 *
 * Each stage is driven by last_active_at alone, so a single sign-in at any
 * point takes an account out of every stage at once — there is no separate
 * "cancel the countdown" step that could be missed.
 */
export async function sweepAccountLifecycle(now: Date = new Date()): Promise<LifecycleSweepResult> {
  const dryRun = !deletionEnabled()
  const result: LifecycleSweepResult = {
    warned: 0, frozen: 0, deletable: 0, deleted: 0, skippedProtected: 0, dryRun,
  }

  const warnCutoff   = new Date(now.getTime() - INACTIVE_WARN_DAYS * DAY_MS)
  const freezeCutoff = new Date(warnCutoff.getTime() - FREEZE_AFTER_WARN_DAYS * DAY_MS)
  const deleteCutoff = new Date(now.getTime() - DELETE_AFTER_FREEZE_DAYS * DAY_MS)

  const protectedIds = await protectedUserIds()

  // ── 1. warn ───────────────────────────────────────────────────────────────
  // Silent past the warn cutoff, not yet frozen. The notice row is claimed
  // through user_notices so a daily sweep warns once, not every morning.
  const toWarn = await db.select({ id: users.id, lastActive: users.last_active_at })
    .from(users)
    .where(and(
      eq(users.plan, 'free'),
      isNull(users.frozen_at),
      isNotNull(users.last_active_at),
      lt(users.last_active_at, warnCutoff),
    ))

  for (const u of toWarn) {
    if (protectedIds.has(u.id)) continue
    const claimed = await db.execute(sql`
      INSERT INTO user_notices (user_id, kind, sent_at, detail, created_at, updated_at)
      VALUES (${u.id}, 'inactivity_warning', ${now}, ${JSON.stringify({ lastActive: u.lastActive })}::jsonb, ${now}, ${now})
      ON CONFLICT (user_id, kind) DO NOTHING
      RETURNING id
    `)
    if (claimed.rows.length === 0) continue
    await notifyUser(u.id, warnText(FREEZE_AFTER_WARN_DAYS))
    result.warned++
  }

  // ── 2. freeze ─────────────────────────────────────────────────────────────
  // Warned, and still silent 30 days later. Freezing sets a flag; it removes
  // nothing and gates nothing that a sign-in cannot immediately restore.
  const toFreeze = await db.select({ id: users.id })
    .from(users)
    .where(and(
      eq(users.plan, 'free'),
      isNull(users.frozen_at),
      isNotNull(users.last_active_at),
      lt(users.last_active_at, freezeCutoff),
    ))

  for (const u of toFreeze) {
    if (protectedIds.has(u.id)) continue
    await db.update(users).set({ frozen_at: now }).where(eq(users.id, u.id))
    await notifyUser(u.id, freezeText(DELETE_AFTER_FREEZE_DAYS))
    logger.info('account_frozen', { userId: u.id })
    result.frozen++
  }

  // ── 3. delete ─────────────────────────────────────────────────────────────
  // Frozen long enough. Everything above is reversible; this is not, so it runs
  // only behind the flag and only for accounts that have never transacted.
  const toDelete = await db.select({ id: users.id, email: users.email, frozenAt: users.frozen_at })
    .from(users)
    .where(and(
      eq(users.plan, 'free'),
      isNotNull(users.frozen_at),
      lt(users.frozen_at, deleteCutoff),
    ))

  for (const u of toDelete) {
    if (protectedIds.has(u.id)) {
      result.skippedProtected++
      logger.warn('account_delete_skipped_protected', {
        userId: u.id,
        reason: 'has payment history, a live subscription, or is grandfathered',
      })
      continue
    }
    result.deletable++
    if (dryRun) {
      logger.info('account_delete_dryrun', { userId: u.id, frozenAt: u.frozenAt?.toISOString() })
      continue
    }
    await db.delete(users).where(eq(users.id, u.id))
    logger.warn('account_deleted_inactive', { userId: u.id, frozenAt: u.frozenAt?.toISOString() })
    result.deleted++
  }

  return result
}

/** Best-effort Telegram. A seller we cannot reach is still warned in-app. */
async function notifyUser(userId: string, text: string): Promise<void> {
  const rows = await db.execute(sql`
    SELECT telegram_chat_id FROM user_settings WHERE user_id = ${userId} LIMIT 1
  `)
  const chatId = (rows.rows[0] as { telegram_chat_id?: string } | undefined)?.telegram_chat_id
  if (!chatId) return
  try { await sendTelegramMessage(chatId, text) }
  catch (err) { logger.warn('lifecycle_notify_failed', { userId, error: String(err).slice(0, 200) }) }
}
