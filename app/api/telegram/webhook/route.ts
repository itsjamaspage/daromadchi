import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/api/auth'
import { sendTelegramMessage } from '@/lib/telegram'

// Telegram sends updates to this endpoint.
// Register via: GET https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://daromadchi.uz/api/telegram/webhook
// Always return 200 so Telegram doesn't retry.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  const message = body.message
  if (!message?.text) return NextResponse.json({ ok: true })

  const chatId   = String(message.chat.id)
  const username = (message.from?.username as string | undefined) ?? null
  const text     = (message.text as string).trim()

  // Handle /start {token} — links the chat to a daromadchi account
  if (text.startsWith('/start ') || text.startsWith('/start@')) {
    const token = text.split(' ')[1]?.trim()
    if (!token) {
      await sendTelegramMessage(chatId, '👋 Daromadchi botiga xush kelibsiz!\nUlanish uchun kengaytmadan havola oling.')
      return NextResponse.json({ ok: true })
    }

    const { data: settings } = await supabaseAdmin
      .from('user_settings')
      .select('user_id, telegram_link_expires_at')
      .eq('telegram_link_token', token)
      .maybeSingle()

    if (!settings) {
      await sendTelegramMessage(chatId, '❌ Token topilmadi. Kengaytmadan yangi havola oling.')
      return NextResponse.json({ ok: true })
    }

    if (new Date(settings.telegram_link_expires_at) < new Date()) {
      await sendTelegramMessage(chatId, '⏰ Token muddati tugagan (10 daqiqa). Kengaytmadan yangi havola oling.')
      return NextResponse.json({ ok: true })
    }

    await supabaseAdmin
      .from('user_settings')
      .update({
        telegram_chat_id:         chatId,
        telegram_username:        username,
        telegram_link_token:      null,
        telegram_link_expires_at: null,
        updated_at:               new Date().toISOString(),
      })
      .eq('user_id', settings.user_id)

    await sendTelegramMessage(
      chatId,
      `✅ <b>Muvaffaqiyatli ulandi!</b>\n\nEndi Daromadchi ogohlantirishlari shu chatga yuboriladi.\n\nTo'liq tahlil: https://daromadchi.uz/dashboard`
    )
    return NextResponse.json({ ok: true })
  }

  // /start with no token (fresh bot open)
  if (text === '/start') {
    await sendTelegramMessage(chatId, '👋 Daromadchi botiga xush kelibsiz!\nUlanish uchun kengaytmadan "Telegram ulash" tugmasini bosing.')
  }

  return NextResponse.json({ ok: true })
}
