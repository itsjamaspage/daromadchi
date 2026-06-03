import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/api/auth'
import { sendTelegramMessage, sendTelegramKeyboard, answerCallbackQuery } from '@/lib/telegram'

// Register via: GET https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://daromadchi.uz/api/telegram/webhook
// Always return 200 so Telegram doesn't retry.

const NOTIF_LABELS: Record<string, string> = {
  morning: '🌅 Ertalab 8:00',
  noon:    '☀️ Kunduzi 13:00',
  evening: '🌆 Kechqurun 20:00',
}

export async function POST(req: NextRequest) {
  // Optional anti-spoofing: if TELEGRAM_WEBHOOK_SECRET is set, Telegram must
  // echo it back in this header (configured via setWebhook?secret_token=...).
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expectedSecret) {
    const got = req.headers.get('x-telegram-bot-api-secret-token')
    if (got !== expectedSecret) return NextResponse.json({ ok: true })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  // ── callback_query: user tapped a notification-time button ──
  if (body.callback_query) {
    const cb     = body.callback_query
    const chatId = String(cb.message?.chat?.id ?? cb.from?.id)
    const data   = (cb.data ?? '') as string

    if (data.startsWith('notif_time:')) {
      const notifTime = data.replace('notif_time:', '')

      await supabaseAdmin
        .from('user_settings')
        .update({ notification_time: notifTime, updated_at: new Date().toISOString() })
        .eq('telegram_chat_id', chatId)

      await answerCallbackQuery(cb.id, '✅ Saqlandi!')
      await sendTelegramMessage(
        chatId,
        `✅ Kunlik hisobot vaqti: <b>${NOTIF_LABELS[notifTime] ?? notifTime}</b> ga sozlandi.\n\nTo'liq tahlil: https://daromadchi.uz/dashboard`
      )
    }

    return NextResponse.json({ ok: true })
  }

  // ── regular message ──
  const message = body.message
  if (!message?.text) return NextResponse.json({ ok: true })

  const chatId   = String(message.chat.id)
  const username = (message.from?.username as string | undefined) ?? null
  const text     = (message.text as string).trim()

  // /start {token} — link account
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

    await sendTelegramKeyboard(
      chatId,
      `✅ <b>Muvaffaqiyatli ulandi!</b>\n\nKunlik hisobotni qaysi vaqtda olishni xohlaysiz?`,
      [[
        { text: '🌅 Ertalab 8:00',    callback_data: 'notif_time:morning' },
        { text: '☀️ Kunduzi 13:00',   callback_data: 'notif_time:noon'    },
        { text: '🌆 Kechqurun 20:00', callback_data: 'notif_time:evening' },
      ]]
    )
    return NextResponse.json({ ok: true })
  }

  // /start with no token
  if (text === '/start') {
    await sendTelegramMessage(
      chatId,
      '👋 Daromadchi botiga xush kelibsiz!\nUlanish uchun kengaytmadan "Telegram ulash" tugmasini bosing.'
    )
  }

  return NextResponse.json({ ok: true })
}
