/**
 * Telling a free seller where they stand.
 *
 * Four moments, all measured from data the account already produces — no new
 * scheduler, no new source of truth:
 *
 *   trial_ending   the trial has days left. Restores a promise the help articles
 *                  used to make and nothing kept, which is why it was removed
 *                  from the docs until this existed.
 *   trial_ended    the trial is over and the paid sections have locked.
 *   outgrew_free   turnover has passed the Free ceiling, so the ladder now puts
 *                  them on a paid tier.
 *
 * A nudge is a SUGGESTION. Nothing here changes a plan, an entitlement or a
 * price: it tells the seller what the numbers say and leaves the decision with
 * them. users.derived_tier is read here — that is exactly what a recommendation
 * is for — while lib/billing/entitlement.ts still refuses to look at it.
 *
 * Throttling is the unique (user_id, kind) row in user_notices. The sweep runs
 * daily; without it a free seller would be told they had outgrown Free every
 * morning for the rest of their life.
 */
import 'server-only'
import { and, eq, isNotNull, isNull, lt, gt, ne, sql, desc } from 'drizzle-orm'
import { db, users, userSettings, userNotices } from '@/lib/db'
import { sendTelegramMessage } from '@/lib/telegram'
import { TRIAL_DAYS } from '@/lib/billing/features'
import { tierPriceTiyin } from '@/lib/billing/tier-pricing'
import { formatSomFromTiyin } from '@/lib/billing/plans'
import type { Tier } from '@/lib/billing/tiers'
import { TRIAL_REMINDER_DAYS, RENUDGE_DAYS } from '@/lib/billing/nudge-constants'
import { logger } from '@/lib/logger'

export const NOTICE_KINDS = ['trial_ending', 'trial_ended', 'outgrew_free'] as const
export type NoticeKind = (typeof NOTICE_KINDS)[number]

// Timings live in ./nudge-constants.ts: the help articles quote them and are
// reachable from client code, which cannot import this module's database driver.
export { TRIAL_REMINDER_DAYS, RENUDGE_DAYS }

const DAY_MS = 24 * 60 * 60 * 1000

export interface ActiveNotice {
  kind: NoticeKind | string
  sentAt: Date
  detail: Record<string, unknown> | null
}

/** The banner the dashboard shows: newest nudge the seller has not dismissed. */
export async function getActiveNotice(userId: string): Promise<ActiveNotice | null> {
  const [row] = await db.select({
    kind: userNotices.kind,
    sentAt: userNotices.sent_at,
    detail: userNotices.detail,
  }).from(userNotices)
    .where(and(eq(userNotices.user_id, userId), isNull(userNotices.dismissed_at)))
    .orderBy(desc(userNotices.sent_at))
    .limit(1)
  return row ? { kind: row.kind, sentAt: row.sentAt, detail: row.detail ?? null } : null
}

/** The seller closed the banner. Telegram delivery is unaffected. */
export async function dismissNotice(userId: string, kind: string, now: Date = new Date()): Promise<void> {
  await db.update(userNotices)
    .set({ dismissed_at: now, updated_at: now })
    .where(and(eq(userNotices.user_id, userId), eq(userNotices.kind, kind), isNull(userNotices.dismissed_at)))
}

/**
 * Record that a nudge went out, or refuse because one already did.
 *
 * The upsert IS the throttle, and it is done in one statement so two overlapping
 * sweeps cannot both decide they are first. Returns false when the existing row
 * is younger than `minAgeDays`, which is the caller's cue not to send.
 */
async function claimNotice(
  userId: string, kind: NoticeKind, detail: Record<string, unknown>,
  minAgeDays: number | null, now: Date,
): Promise<boolean> {
  const cutoff = minAgeDays === null ? null : new Date(now.getTime() - minAgeDays * DAY_MS)

  const claimed = await db.insert(userNotices)
    .values({ user_id: userId, kind, sent_at: now, detail, created_at: now, updated_at: now })
    .onConflictDoUpdate({
      target: [userNotices.user_id, userNotices.kind],
      // Re-sendable kinds only, and only once the row is old enough. A kind with
      // minAgeDays null never matches, so it is sent exactly once ever.
      set: { sent_at: now, dismissed_at: null, detail, updated_at: now },
      where: cutoff === null ? sql`false` : lt(userNotices.sent_at, cutoff),
    })
    .returning({ id: userNotices.id })

  return claimed.length > 0
}

/* ── copy ─────────────────────────────────────────────────────────────────── */

type NoticeLang = 'uz' | 'ru' | 'en'

function pickLang(v: string | null): NoticeLang {
  return v === 'ru' || v === 'en' ? v : 'uz'
}

/** so'm, thousands-spaced, matching every other money figure in the product. */
const som = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

function trialEndingText(lang: NoticeLang, daysLeft: number): string {
  if (lang === 'ru') {
    return `⏳ <b>Пробный период заканчивается</b>\n\nОсталось дней: <b>${daysLeft}</b>. После этого аналитика, склад, финансы и юнит-экономика закроются — дашборд, товары, заказы и оба маркетплейса останутся бесплатными навсегда.\n\nТариф подбирается по вашему обороту: /pricing`
  }
  if (lang === 'en') {
    return `⏳ <b>Your trial is ending</b>\n\n<b>${daysLeft}</b> day(s) left. After that analytics, stock sync, finances and unit economics lock — dashboard, products, orders and both marketplaces stay free for good.\n\nYour tier follows your turnover: /pricing`
  }
  return `⏳ <b>Sinov muddati tugayapti</b>\n\n<b>${daysLeft}</b> kun qoldi. Shundan keyin tahlil, ombor, moliya va unit-iqtisod yopiladi — boshqaruv paneli, mahsulotlar, buyurtmalar va ikkala marketpleys esa doimo bepul qoladi.\n\nTarif aylanmangizga qarab tanlanadi: /pricing`
}

function trialEndedText(lang: NoticeLang): string {
  if (lang === 'ru') {
    return `🔒 <b>Пробный период закончился</b>\n\nАналитика, склад, финансы и юнит-экономика закрыты. Дашборд, товары, заказы и оба маркетплейса остаются бесплатными.\n\nЧтобы вернуть доступ, выберите тариф — он подбирается по вашему обороту.`
  }
  if (lang === 'en') {
    return `🔒 <b>Your trial has ended</b>\n\nAnalytics, stock sync, finances and unit economics are locked. Dashboard, products, orders and both marketplaces stay free.\n\nTo restore access, choose a plan — your tier follows your turnover.`
  }
  return `🔒 <b>Sinov muddati tugadi</b>\n\nTahlil, ombor, moliya va unit-iqtisod yopildi. Boshqaruv paneli, mahsulotlar, buyurtmalar va ikkala marketpleys bepul qoladi.\n\nKirishni tiklash uchun tarifni tanlang — u aylanmangizga qarab belgilanadi.`
}

function outgrewFreeText(lang: NoticeLang, turnoverSom: number, tier: Tier): string {
  const priceTiyin = tierPriceTiyin(tier, 'monthly')
  const price = priceTiyin && priceTiyin > 0 ? `${formatSomFromTiyin(priceTiyin)} so'm` : null
  const name = tier === 'pro_plus' ? 'Pro+' : tier === 'biznes' ? 'Biznes' : tier === 'pro' ? 'Pro' : 'Enterprise'

  if (lang === 'ru') {
    return `📈 <b>Ваш оборот вырос</b>\n\nЗа последние 30 дней: <b>${som(turnoverSom)} сум</b>. По нашей шкале это тариф <b>${name}</b>${price ? ` — ${price}/мес` : ''}.\n\nНичего не списывается автоматически: тариф вы подключаете сами, когда решите.`
  }
  if (lang === 'en') {
    return `📈 <b>Your turnover has grown</b>\n\nOver the last 30 days: <b>${som(turnoverSom)} so'm</b>. On our ladder that is <b>${name}</b>${price ? ` — ${price}/mo` : ''}.\n\nNothing is charged automatically: you subscribe when you decide to.`
  }
  return `📈 <b>Aylanmangiz o'sdi</b>\n\nSo'nggi 30 kunda: <b>${som(turnoverSom)} so'm</b>. Bizning shkalamiz bo'yicha bu <b>${name}</b>${price ? ` — ${price} so'm/oy` : ''}.\n\nHech narsa avtomatik yechilmaydi: tarifni o'zingiz xohlaganingizda ulaysiz.`
}

/* ── the sweep ────────────────────────────────────────────────────────────── */

export interface NudgeSweepResult {
  trialEnding: number
  trialEnded: number
  outgrewFree: number
}

/** Telegram is best-effort: the in-app banner is recorded either way. */
async function tell(chatId: string | null, text: string): Promise<void> {
  if (!chatId) return
  try { await sendTelegramMessage(chatId, text) }
  catch (err) { logger.warn('nudge_telegram_failed', { error: String(err).slice(0, 200) }) }
}

/**
 * Send the three free-tier nudges. Rides the daily expire-plans job.
 *
 * Unlike the price notice, delivery is NOT a precondition for anything: a nudge
 * that fails to send costs the seller nothing, so it is recorded and shown
 * in-app regardless. Only a charge needs proof of notice.
 */
export async function dispatchTierNudges(now: Date = new Date()): Promise<NudgeSweepResult> {
  const result: NudgeSweepResult = { trialEnding: 0, trialEnded: 0, outgrewFree: 0 }
  const reminderAt = new Date(now.getTime() + TRIAL_REMINDER_DAYS * DAY_MS)

  // ── trial ending ──────────────────────────────────────────────────────────
  const ending = await db.select({
    id: users.id, trialEndsAt: users.trial_ends_at,
    chatId: userSettings.telegram_chat_id, lang: userSettings.notif_lang,
  }).from(users)
    .leftJoin(userSettings, eq(userSettings.user_id, users.id))
    .where(and(
      eq(users.plan, 'free'),
      isNotNull(users.trial_ends_at),
      gt(users.trial_ends_at, now),
      lt(users.trial_ends_at, reminderAt),
    ))

  for (const u of ending) {
    const daysLeft = Math.max(1, Math.ceil((u.trialEndsAt!.getTime() - now.getTime()) / DAY_MS))
    if (!await claimNotice(u.id, 'trial_ending', { daysLeft, trialDays: TRIAL_DAYS }, null, now)) continue
    await tell(u.chatId, trialEndingText(pickLang(u.lang), daysLeft))
    result.trialEnding++
  }

  // ── trial ended ───────────────────────────────────────────────────────────
  const ended = await db.select({
    id: users.id,
    chatId: userSettings.telegram_chat_id, lang: userSettings.notif_lang,
  }).from(users)
    .leftJoin(userSettings, eq(userSettings.user_id, users.id))
    .where(and(
      eq(users.plan, 'free'),
      isNotNull(users.trial_ends_at),
      lt(users.trial_ends_at, now),
    ))

  for (const u of ended) {
    if (!await claimNotice(u.id, 'trial_ended', {}, null, now)) continue
    await tell(u.chatId, trialEndedText(pickLang(u.lang)))
    result.trialEnded++
  }

  // ── outgrew free ──────────────────────────────────────────────────────────
  // Reads the derived tier, which the same daily job recomputes just before this
  // runs. A free account whose measured turnover now lands on a paid rung.
  const outgrown = await db.select({
    id: users.id, tier: users.derived_tier, turnover: users.derived_turnover_som,
    chatId: userSettings.telegram_chat_id, lang: userSettings.notif_lang,
  }).from(users)
    .leftJoin(userSettings, eq(userSettings.user_id, users.id))
    .where(and(
      eq(users.plan, 'free'),
      isNotNull(users.derived_tier),
      ne(users.derived_tier, 'free'),
    ))

  for (const u of outgrown) {
    const turnover = Number(u.turnover ?? 0)
    if (!Number.isFinite(turnover) || turnover <= 0) continue
    const tier = u.tier as Tier
    if (!await claimNotice(u.id, 'outgrew_free', { turnoverSom: turnover, tier }, RENUDGE_DAYS, now)) continue
    await tell(u.chatId, outgrewFreeText(pickLang(u.lang), turnover, tier))
    result.outgrewFree++
  }

  return result
}
