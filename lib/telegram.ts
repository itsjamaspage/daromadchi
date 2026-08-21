const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME

export function telegramConfigured(): boolean {
  return !!(BOT_TOKEN && BOT_USERNAME)
}

export function telegramDeepLink(token: string): string {
  return `https://t.me/${BOT_USERNAME}?start=${token}`
}

export async function sendTelegramPhoto(chatId: string, imageDataUrl: string, caption: string): Promise<boolean> {
  if (!BOT_TOKEN) return false
  try {
    const base64 = imageDataUrl.split(',')[1]
    const mimeMatch = imageDataUrl.match(/data:([^;]+);/)
    const mime = mimeMatch?.[1] ?? 'image/png'
    const ext = mime.split('/')[1] ?? 'png'
    const buffer = Buffer.from(base64, 'base64')
    const formData = new FormData()
    formData.append('chat_id', chatId)
    formData.append('caption', caption)
    formData.append('parse_mode', 'HTML')
    formData.append('photo', new Blob([buffer], { type: mime }), `screenshot.${ext}`)
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: formData,
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Attempts for a send that failed for a reason that might not repeat. One try
 * meant a network blip or a Telegram 429/503 silently dropped a seller's alert
 * forever — there is no queue behind this and no second chance later.
 *
 * Kept small on purpose: this runs inside cron loops over every seller, so the
 * budget is "survive a hiccup", not "guarantee delivery to an unreachable
 * chat". A permanent rejection (400 blocked/deactivated, 403) is never retried.
 */
const SEND_ATTEMPTS = 3
const SEND_BACKOFF_MS = [400, 1500]

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** 429 and 5xx are worth another try; 4xx otherwise means it will never work. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!BOT_TOKEN) return false
  for (let attempt = 0; attempt < SEND_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      })
      if (res.ok) return true
      if (!isRetryableStatus(res.status)) return false
      // Telegram says how long to wait on a 429; honour it, but never let it
      // stall a cron loop for minutes.
      let waitMs = SEND_BACKOFF_MS[attempt] ?? 1500
      if (res.status === 429) {
        try {
          const body = await res.clone().json() as { parameters?: { retry_after?: number } }
          const ra = body?.parameters?.retry_after
          if (typeof ra === 'number' && ra > 0) waitMs = Math.min(ra * 1000, 5000)
        } catch { /* keep the default backoff */ }
      }
      if (attempt < SEND_ATTEMPTS - 1) await sleep(waitMs)
    } catch {
      // Network-level failure — retryable by nature.
      if (attempt < SEND_ATTEMPTS - 1) await sleep(SEND_BACKOFF_MS[attempt] ?? 1500)
    }
  }
  return false
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

export async function editMessageButtons(
  chatId: string,
  messageId: number,
  buttons: InlineButton[][],
): Promise<boolean> {
  if (!BOT_TOKEN) return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:      chatId,
        message_id:   messageId,
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

const CHANNEL_USERNAME = '@daromadchi_uz'

export async function checkChannelMember(telegramChatId: string): Promise<boolean> {
  if (!BOT_TOKEN) return false
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(CHANNEL_USERNAME)}&user_id=${telegramChatId}`
    )
    if (!res.ok) return false
    const data = await res.json()
    const status = data?.result?.status
    return ['member', 'administrator', 'creator'].includes(status)
  } catch {
    return false
  }
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
