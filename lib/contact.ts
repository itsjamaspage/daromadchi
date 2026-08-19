/**
 * Where a visitor goes to reach a human.
 *
 * Three Telegram destinations exist and they are not interchangeable — pointing
 * a "Contact us" button at the wrong one is what this module prevents:
 *
 *   channel — a BROADCAST. Nobody can write to it. A contact button aimed here
 *             is a dead end, which is exactly what shipped before.
 *   bot     — writes TO sellers (stock alerts, daily summaries). It does forward
 *             free text to the operator chat, but /start puts a newcomer through
 *             a language picker and the extension-activation flow first.
 *   support — a staffed account. A person opens a chat and types. Nothing to
 *             set up, nothing to get past. This is the contact route.
 */

/** The public channel. Only for "join our channel" prompts, never for contact. */
export const TELEGRAM_CHANNEL_URL = 'https://t.me/daromadchi_uz'

/** The alerts bot. Notifications out; not a front door. */
export const TELEGRAM_BOT_URL = 'https://t.me/daromadchi_alerts_bot'

/** The staffed support account — every "Contact us" on the site opens this. */
export const TELEGRAM_CONTACT_URL = 'https://t.me/daromadchi_support'
