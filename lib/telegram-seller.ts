import 'server-only'
import { eq } from 'drizzle-orm'
import { db, userSettings } from '@/lib/db'
import { sendTelegramMessage } from '@/lib/telegram'
import { notifT, normalizeLang, type NotifLang, type NotifStrings } from '@/lib/notif-i18n'
import { logger } from '@/lib/logger'

/**
 * THE ONLY WAY TO SEND A TELEGRAM MESSAGE TO A SELLER.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * sendTelegramMessage(chatId, text) takes a finished string. That made the
 * wrong thing easy: a caller had to remember, with no prompting from the
 * compiler, to (a) select notif_lang, (b) look up the strings, and (c) not just
 * type the message inline. Four separate senders forgot — the new-order alert
 * shipped Uzbek to everyone, the stock digest Russian, the extension summary
 * Uzbek, oversell alerts English — and a Russian seller received two different
 * languages in one chat.
 *
 * Localising those four fixed four bugs and prevented none. This fixes the
 * cause: the seller's language is no longer something a caller can forget,
 * because a caller never handles it. Pass a userId and a builder; the chat id
 * and the language are resolved here, together, or nothing is sent.
 *
 * ── Why a builder and not a string ──────────────────────────────────────────
 * `build` receives the resolved strings. There is no way to produce the text
 * before the language is known, so there is no way to hand this function a
 * hardcoded message — the type rejects it. That is the whole point: the failure
 * mode is designed out rather than detected afterwards.
 *
 * ── Enforcement ─────────────────────────────────────────────────────────────
 * eslint.config.mjs bans importing sendTelegramMessage anywhere except this
 * file and the few genuinely non-seller senders (admin alerts, the bot webhook
 * replying in the chat's own language). Adding a seller notification that
 * bypasses this now fails lint, which fails the build.
 *
 * Returns false when the seller has no Telegram linked, or the send failed —
 * never throws, because a notification must not break the job that triggered it.
 */
export async function sendSellerMessage(
  userId: string,
  build: (T: NotifStrings, lang: NotifLang) => string,
): Promise<boolean> {
  const [s] = await db.select({
    chat: userSettings.telegram_chat_id,
    lang: userSettings.notif_lang,
  }).from(userSettings).where(eq(userSettings.user_id, userId))

  if (!s?.chat) return false
  const lang = normalizeLang(s.lang)
  try {
    return await sendTelegramMessage(s.chat, build(notifT(lang), lang))
  } catch (e) {
    logger.warn('seller_message_failed', { userId, error: String(e).slice(0, 200) })
    return false
  }
}

/**
 * Same contract for a caller that ALREADY holds the seller's settings row and
 * would otherwise re-query for them (the sync cron loops over every seller).
 * The language still cannot be skipped — it is a required argument, and the
 * body is still a builder.
 */
export async function sendSellerMessageTo(
  chatId: string,
  lang: string | null | undefined,
  build: (T: NotifStrings, lang: NotifLang) => string,
): Promise<boolean> {
  const l = normalizeLang(lang)
  try {
    return await sendTelegramMessage(chatId, build(notifT(l), l))
  } catch (e) {
    logger.warn('seller_message_failed', { error: String(e).slice(0, 200) })
    return false
  }
}
