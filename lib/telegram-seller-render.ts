import { notifT, type NotifLang, type NotifStrings } from '@/lib/notif-i18n'
import { logger } from '@/lib/logger'

/** Last resort when even the Uzbek build throws — the seller still learns something happened. */
export const FALLBACK_TEXT = '🔔 Daromadchi: https://daromadchi.uz/dashboard'

/**
 * Where a Telegram alert sends the seller: the in-app list of the same events.
 * Env-driven so a staging bot links to staging, with the production apex as the
 * fallback — the same pair app/api/telegram/setup-webhook already uses.
 */
export function notificationsUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'https://daromadchi.uz'
  return `${base.replace(/\/+$/, '')}/dashboard/notifications`
}

/**
 * Render a seller message, never letting a localisation bug swallow the alert.
 *
 * Pure and DB-free on purpose: this is the step that decides whether a seller
 * hears about an order at all, so it is unit-testable without a server context.
 * lib/telegram-seller.ts calls it and adds the chat lookup and the transport.
 */
export function renderSellerText(
  build: (T: NotifStrings, lang: NotifLang) => string,
  lang: NotifLang,
  userId?: string,
): string {
  try {
    return withCta(build(notifT(lang), lang), lang)
  } catch (e) {
    logger.error('seller_message_build_failed', { userId, lang, error: String(e).slice(0, 300) })
  }
  if (lang !== 'uz') {
    try {
      return withCta(build(notifT('uz'), 'uz'), 'uz')
    } catch (e) {
      logger.error('seller_message_build_failed_fallback_lang', { userId, error: String(e).slice(0, 300) })
    }
  }
  logger.error('seller_message_using_generic_fallback', { userId, lang })
  // FALLBACK_TEXT already carries its own link — appending a second one would
  // give the one message that exists for emergencies two competing exits.
  return FALLBACK_TEXT
}

/**
 * Close every seller alert with a link to the in-app notification list.
 *
 * Here rather than in each builder on purpose: this is the single funnel every
 * seller alert passes through — digest, new orders, cancellations, stock-sync,
 * oversell, manual-stock, extension alerts, price notices — so the link lands on
 * all of them, and on any alert type added later without anyone remembering to.
 *
 * A message that already ends with the link keeps just the one: builders are
 * free to place it themselves, and a duplicate would read as a mistake. If the
 * CTA itself throws, the alert still goes out without it — a seller learning
 * about an oversell matters more than a footer.
 */
function withCta(text: string, lang: NotifLang): string {
  try {
    const url = notificationsUrl()
    if (text.includes(url)) return text
    return `${text}\n${notifT(lang).notificationsCta(url)}`
  } catch {
    return text
  }
}

/** Alias used by the unit tests. */
export const renderForTest = renderSellerText
