/**
 * Where a visitor goes to reach a human.
 *
 * The channel (@daromadchi_uz) is a BROADCAST — nobody can write to it — so a
 * "Contact us" button pointed there is a dead end. Every such button goes to the
 * bot instead, which forwards free text to the admin chat (see
 * app/api/telegram/webhook). Keeping both URLs here means a "contact" link can
 * never be pasted at the channel again by accident.
 */

/** The public channel. Only for "join our channel" prompts, never for contact. */
export const TELEGRAM_CHANNEL_URL = 'https://t.me/daromadchi_uz'

/** The bot. It reaches a person. */
export const TELEGRAM_BOT_URL = 'https://t.me/daromadchi_alerts_bot'

/**
 * A contact link that tells the bot where the visitor came from.
 *
 * The payload matters: a bare /start drops them into the language picker and the
 * extension-activation flow, which is the same "wrong page" feeling as the
 * channel. With it the bot greets them, asks for their question, and pings the
 * admin chat that someone is waiting.
 *
 * Telegram allows A–Z a–z 0–9 _ - in a start payload, 64 chars max.
 */
export function telegramContactUrl(source: 'pricing' | 'enterprise' | 'help'): string {
  return `${TELEGRAM_BOT_URL}?start=contact_${source}`
}
