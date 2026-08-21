import { notifT, type NotifLang, type NotifStrings } from '@/lib/notif-i18n'
import { logger } from '@/lib/logger'

/** Last resort when even the Uzbek build throws — the seller still learns something happened. */
export const FALLBACK_TEXT = '🔔 Daromadchi: https://daromadchi.uz/dashboard'

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
    return build(notifT(lang), lang)
  } catch (e) {
    logger.error('seller_message_build_failed', { userId, lang, error: String(e).slice(0, 300) })
  }
  if (lang !== 'uz') {
    try {
      return build(notifT('uz'), 'uz')
    } catch (e) {
      logger.error('seller_message_build_failed_fallback_lang', { userId, error: String(e).slice(0, 300) })
    }
  }
  logger.error('seller_message_using_generic_fallback', { userId, lang })
  return FALLBACK_TEXT
}

/** Alias used by the unit tests. */
export const renderForTest = renderSellerText
