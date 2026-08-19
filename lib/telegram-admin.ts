/**
 * The chat(s) that receive operational alerts: feedback, deletion requests and
 * questions people send the bot.
 *
 * Read from TELEGRAM_ADMIN_CHAT_ID (comma-separated for more than one operator)
 * so adding or moving an operator is a config change, not a deploy. The literal
 * below is the chat that has been receiving these all along — it stays as the
 * fallback so an unset variable cannot silently drop alerts on the floor, which
 * is the one failure mode that would go unnoticed.
 */
const FALLBACK_ADMIN_CHAT_ID = '6884517020'

export const ADMIN_CHAT_IDS: readonly string[] = (() => {
  const raw = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim()
  if (!raw) return [FALLBACK_ADMIN_CHAT_ID]
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean)
  return ids.length > 0 ? ids : [FALLBACK_ADMIN_CHAT_ID]
})()
