/**
 * Raising an existing subscriber's price, with notice.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 * NOBODY IS CHARGED AN AMOUNT THEY WERE NOT TOLD ABOUT IN ADVANCE.
 *
 * agreed_amount_tiyin already stops the renewal charging whatever the config
 * currently says. This module is the ONLY sanctioned way that agreed amount ever
 * moves, and it moves through three gates:
 *
 *   1. STAGED    an operator sets pending_amount_tiyin + pending_effective_date.
 *                Nothing is charged. The renewal still bills the agreed amount.
 *   2. NOTIFIED  the seller is told — Telegram and/or email — naming the new
 *                amount and the date. Delivery is recorded in
 *                pending_notified_at. A notice that failed to send is NOT
 *                recorded, so the increase never takes effect.
 *   3. CHARGED   at the first renewal on or after the effective date, provided
 *                the notice is at least PRICE_NOTICE_DAYS old. Only after that
 *                charge succeeds is pending promoted into agreed.
 *
 * Every failure mode of this module fails toward "keep charging what they
 * agreed to". That is the direction that cannot produce a refund and a
 * complaint.
 *
 * A seller who does not want the new price cancels (lib/billing/cancel.ts).
 * Cancelling leaves the pending row alone — it is a record of what was offered
 * — but a cancelled subscription is never selected for renewal, so the new
 * amount is never charged.
 */
import 'server-only'
import { and, eq, isNotNull, isNull, lte, inArray, desc } from 'drizzle-orm'
import { db, subscriptions, userSettings } from '@/lib/db'
import { sendSellerMessageTo } from '@/lib/telegram-seller'
import { formatSomFromTiyin, PRICE_NOTICE_DAYS } from '@/lib/billing/plans'
import { logger } from '@/lib/logger'

// The notice period lives with the prices in ./plans.ts — /terms quotes it and
// is a client component, so it cannot import this module. Re-exported here so
// callers of the notice logic have it to hand.
export { PRICE_NOTICE_DAYS }
const DAY_MS = 24 * 60 * 60 * 1000

/** Subscriptions a price change can be staged against. */
const LIVE_STATUSES = ['active', 'past_due'] as const

export interface PendingPriceChange {
  subscriptionId: string
  /** What they pay today. */
  currentAmountTiyin: number | null
  /** What they will pay from effectiveDate, once notified. */
  newAmountTiyin: number
  effectiveDate: Date
  notifiedAt: Date | null
}

/** The staged change the billing page and the in-app notice read. */
export async function getPendingPriceChange(userId: string): Promise<PendingPriceChange | null> {
  const [row] = await db.select({
    id: subscriptions.id,
    agreed: subscriptions.agreed_amount_tiyin,
    pending: subscriptions.pending_amount_tiyin,
    effective: subscriptions.pending_effective_date,
    notified: subscriptions.pending_notified_at,
  }).from(subscriptions)
    .where(and(
      eq(subscriptions.user_id, userId),
      inArray(subscriptions.status, [...LIVE_STATUSES]),
      isNotNull(subscriptions.pending_amount_tiyin),
      isNotNull(subscriptions.pending_effective_date),
    ))
    .orderBy(desc(subscriptions.pending_effective_date))
    .limit(1)

  if (!row?.pending || !row.effective) return null
  return {
    subscriptionId: row.id,
    currentAmountTiyin: row.agreed,
    newAmountTiyin: row.pending,
    effectiveDate: row.effective,
    notifiedAt: row.notified,
  }
}

export type StageOutcome =
  | { ok: true; staged: number }
  | { ok: false; reason: 'no_live_subscription' | 'not_an_increase' | 'notice_too_short' }

/**
 * Stage a price change against one subscription.
 *
 * Operator action — there is no self-serve path to this, by design. The two
 * refusals are the guard rails:
 *
 *   notice_too_short  the effective date is less than PRICE_NOTICE_DAYS away, so
 *                     the notice could not be advance notice even if it went out
 *                     today. Staging it would create a row the renewal must
 *                     later refuse; better to refuse now, while a human is here
 *                     to pick a later date.
 *   not_an_increase   the "new" amount is not higher. A decrease needs no notice
 *                     period and should be applied directly rather than staged
 *                     behind a two-week wait the seller does not benefit from.
 */
export async function stagePriceChange(opts: {
  subscriptionId: string
  newAmountTiyin: number
  effectiveDate: Date
  now?: Date
}): Promise<StageOutcome> {
  const now = opts.now ?? new Date()

  if (opts.effectiveDate.getTime() - now.getTime() < PRICE_NOTICE_DAYS * DAY_MS) {
    return { ok: false, reason: 'notice_too_short' }
  }

  const [sub] = await db.select({
    id: subscriptions.id,
    agreed: subscriptions.agreed_amount_tiyin,
  }).from(subscriptions).where(and(
    eq(subscriptions.id, opts.subscriptionId),
    inArray(subscriptions.status, [...LIVE_STATUSES]),
  ))

  if (!sub) return { ok: false, reason: 'no_live_subscription' }
  if (sub.agreed !== null && opts.newAmountTiyin <= sub.agreed) {
    return { ok: false, reason: 'not_an_increase' }
  }

  await db.update(subscriptions).set({
    pending_amount_tiyin: opts.newAmountTiyin,
    pending_effective_date: opts.effectiveDate,
    // Re-staging resets the clock: a changed amount or date is a new offer, and
    // reusing the old delivery timestamp would credit notice for something the
    // seller was never told.
    pending_notified_at: null,
    updated_at: now,
  }).where(eq(subscriptions.id, sub.id))

  logger.info('billing_price_change_staged', {
    subscriptionId: sub.id,
    fromTiyin: sub.agreed, toTiyin: opts.newAmountTiyin,
    effectiveDate: opts.effectiveDate.toISOString(),
  })
  return { ok: true, staged: 1 }
}

/**
 * May this subscription be charged its pending amount right now?
 *
 * Every condition is a reason someone could be overcharged if it were missing,
 * so all four are required and the default is no.
 */
export function pendingAmountIsChargeable(sub: {
  pending_amount_tiyin: number | null
  pending_effective_date: Date | null
  pending_notified_at: Date | null
}, now: Date = new Date()): boolean {
  if (sub.pending_amount_tiyin == null || sub.pending_amount_tiyin <= 0) return false
  if (sub.pending_effective_date == null || sub.pending_effective_date > now) return false
  if (sub.pending_notified_at == null) return false
  return now.getTime() - sub.pending_notified_at.getTime() >= PRICE_NOTICE_DAYS * DAY_MS
}

/**
 * The amount this renewal should charge.
 *
 * Falls back to the agreed amount whenever the pending one is not chargeable —
 * including the case where the effective date has long passed but the notice was
 * never delivered. An undelivered increase must never become chargeable by the
 * mere passage of time.
 */
export function renewalAmountTiyin(sub: {
  agreed_amount_tiyin: number | null
  pending_amount_tiyin: number | null
  pending_effective_date: Date | null
  pending_notified_at: Date | null
}, now: Date = new Date()): number | null {
  return pendingAmountIsChargeable(sub, now) ? sub.pending_amount_tiyin : sub.agreed_amount_tiyin
}

/**
 * Promote a charged pending amount into the agreed one.
 *
 * Called only after the charge at that amount SUCCEEDED. Doing it earlier would
 * move the agreed price on the strength of an attempt, so a failed card would
 * leave the seller agreed to a number they never paid.
 */
export async function promotePendingAmount(subscriptionId: string, now: Date = new Date()): Promise<void> {
  const [sub] = await db.select({
    pending: subscriptions.pending_amount_tiyin,
  }).from(subscriptions).where(eq(subscriptions.id, subscriptionId))
  if (!sub?.pending) return

  await db.update(subscriptions).set({
    agreed_amount_tiyin: sub.pending,
    pending_amount_tiyin: null,
    pending_effective_date: null,
    pending_notified_at: null,
    updated_at: now,
  }).where(eq(subscriptions.id, subscriptionId))

  logger.info('billing_price_change_applied', { subscriptionId, agreedTiyin: sub.pending })
}

/* ── notice delivery ──────────────────────────────────────────────────────── */

type NoticeLang = 'uz' | 'ru' | 'en'

function noticeText(lang: NoticeLang, newAmountTiyin: number, effective: Date): string {
  const amount = formatSomFromTiyin(newAmountTiyin)
  const date = effective.toISOString().slice(0, 10)
  if (lang === 'ru') {
    return `📣 <b>Изменение цены тарифа</b>\n\nС <b>${date}</b> стоимость вашей подписки составит <b>${amount} сум</b>.\n\nДо этой даты списаний по новой цене не будет. Если новая цена вам не подходит, вы можете отменить тариф в разделе «Тариф и оплата» — тогда списания прекратятся, а доступ сохранится до конца оплаченного периода.`
  }
  if (lang === 'en') {
    return `📣 <b>Your plan price is changing</b>\n\nFrom <b>${date}</b> your subscription will cost <b>${amount} so'm</b>.\n\nNothing is charged at the new price before that date. If it does not suit you, cancel from the Billing section — charging stops and your access runs to the end of the period you have paid for.`
  }
  return `📣 <b>Tarif narxi o'zgaradi</b>\n\n<b>${date}</b> dan boshlab obunangiz narxi <b>${amount} so'm</b> bo'ladi.\n\nBu sanagacha yangi narx yechilmaydi. Agar sizga to'g'ri kelmasa, «Tarif va to'lov» bo'limidan tarifni bekor qilishingiz mumkin — shunda to'lovlar to'xtaydi, kirish esa to'langan davr oxirigacha saqlanadi.`
}

export interface NoticeSweepResult {
  due: number
  notified: number
  undeliverable: number
}

/**
 * Tell everyone whose staged change is approaching, and record delivery.
 *
 * Runs from the daily expire-plans job — the spec's instruction is to ride the
 * existing schedule rather than add a scheduler.
 *
 * notified_at is written ONLY when a channel confirmed delivery. A seller we
 * could not reach stays un-notified, which means their price never rises: that
 * is the correct outcome, not a bug to work around, and it is logged so an
 * operator can reach them another way.
 */
export async function dispatchDuePriceNotices(now: Date = new Date()): Promise<NoticeSweepResult> {
  // Anything effective within the notice window, not yet told. Sweeping by
  // effective date (rather than "staged recently") means a notice missed by an
  // outage is retried every day until it lands.
  const horizon = new Date(now.getTime() + PRICE_NOTICE_DAYS * DAY_MS)

  const rows = await db.select({
    id: subscriptions.id,
    userId: subscriptions.user_id,
    pending: subscriptions.pending_amount_tiyin,
    effective: subscriptions.pending_effective_date,
    chatId: userSettings.telegram_chat_id,
    lang: userSettings.notif_lang,
  }).from(subscriptions)
    .leftJoin(userSettings, eq(userSettings.user_id, subscriptions.user_id))
    .where(and(
      inArray(subscriptions.status, [...LIVE_STATUSES]),
      isNotNull(subscriptions.pending_amount_tiyin),
      isNull(subscriptions.pending_notified_at),
      lte(subscriptions.pending_effective_date, horizon),
    ))

  let notified = 0
  let undeliverable = 0

  for (const row of rows) {
    if (!row.pending || !row.effective) continue

    let delivered = false
    if (row.chatId) {
      const lang = (['uz', 'ru', 'en'].includes(row.lang ?? '') ? row.lang : 'uz') as NoticeLang
      const pending = row.pending, effective = row.effective
      try {
        delivered = await sendSellerMessageTo(row.chatId, lang, () => noticeText(lang, pending, effective))
      } catch (err) {
        logger.warn('billing_price_notice_send_failed', {
          subscriptionId: row.id, error: String(err).slice(0, 200),
        })
      }
    }

    if (!delivered) {
      undeliverable++
      logger.error('billing_price_notice_undeliverable', {
        subscriptionId: row.id, userId: row.userId,
        effectiveDate: row.effective.toISOString(),
        reason: row.chatId ? 'send_failed' : 'no_telegram_linked',
      })
      continue
    }

    await db.update(subscriptions)
      .set({ pending_notified_at: now, updated_at: now })
      .where(eq(subscriptions.id, row.id))
    notified++
  }

  return { due: rows.length, notified, undeliverable }
}
