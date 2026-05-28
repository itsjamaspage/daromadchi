const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME

export function telegramConfigured(): boolean {
  return !!(BOT_TOKEN && BOT_USERNAME)
}

export function telegramDeepLink(token: string): string {
  return `https://t.me/${BOT_USERNAME}?start=${token}`
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!BOT_TOKEN) return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    return res.ok
  } catch {
    return false
  }
}

interface InlineButton { text: string; callback_data: string }

export async function sendTelegramKeyboard(
  chatId: string,
  text: string,
  buttons: InlineButton[][],
): Promise<boolean> {
  if (!BOT_TOKEN) return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:      chatId,
        text,
        parse_mode:   'HTML',
        reply_markup: { inline_keyboard: buttons },
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  if (!BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  }).catch(() => {})
}

// Uzbekistan is UTC+5. Returns true when current UTC time is within ±30 min of user's chosen window.
export function isInNotificationWindow(notificationTime: string | null): boolean {
  const utcMinutes = new Date().getUTCHours() * 60 + new Date().getUTCMinutes()
  const targets: Record<string, number> = {
    morning: 3  * 60,   // 08:00 UZT = 03:00 UTC
    noon:    8  * 60,   // 13:00 UZT = 08:00 UTC
    evening: 15 * 60,   // 20:00 UZT = 15:00 UTC
  }
  const target = targets[notificationTime ?? 'evening'] ?? targets.evening
  return Math.abs(utcMinutes - target) <= 30
}
