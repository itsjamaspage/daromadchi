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

      // Map the legacy label to an HH:MM value for the digest cron
      const sendTimeMap: Record<string, string> = {
        morning: '08:00',
        noon:    '13:00',
        evening: '20:00',
      }
      const sendTime = sendTimeMap[notifTime] ?? '09:00'

      await supabaseAdmin
        .from('user_settings')
        .update({
          notification_time: notifTime,
          notif_send_time:   sendTime,
          updated_at:        new Date().toISOString(),
        })
        .eq('telegram_chat_id', chatId)

      await answerCallbackQuery(cb.id, '✅ Saqlandi!')
      await sendTelegramMessage(
        chatId,
        `✅ Kunlik hisobot vaqti: <b>${NOTIF_LABELS[notifTime] ?? notifTime}</b> ga sozlandi.\n\nTo'liq tahlil: https://daromadchi.uz/dashboard`
      )
    }

    // Onboarding: toggle a notification type on/off
    if (data.startsWith('notif_toggle:')) {
      const [, field, val] = data.split(':')
      const colMap: Record<string, string> = {
        low_stock:      'notif_low_stock',
        daily_summary:  'notif_daily_summary',
        new_orders:     'notif_new_orders',
        weekly_report:  'notif_weekly_report',
      }
      const col = colMap[field]
      if (col) {
        const newVal = val === '1'
        await supabaseAdmin
          .from('user_settings')
          .update({ [col]: newVal, updated_at: new Date().toISOString() })
          .eq('telegram_chat_id', chatId)

        const emoji = newVal ? '✅' : '❌'
        const labelMap: Record<string, string> = {
          low_stock:     '📦 Kam zaxira ogohlantirishlari',
          daily_summary: '📊 Kunlik savdo xulosasi',
          new_orders:    '🛒 Yangi buyurtmalar',
          weekly_report: '📈 Haftalik hisobot',
        }
        await answerCallbackQuery(cb.id, `${emoji} ${labelMap[field] ?? field}`)

        // Re-show the notification menu with updated toggle states
        const { data: settings } = await supabaseAdmin
          .from('user_settings')
          .select('notif_low_stock, notif_daily_summary, notif_new_orders, notif_weekly_report')
          .eq('telegram_chat_id', chatId)
          .maybeSingle()

        const s = settings ?? { notif_low_stock: true, notif_daily_summary: true, notif_new_orders: false, notif_weekly_report: false }
        const e = (v: boolean | null | undefined) => v ? '✅' : '❌'

        await sendTelegramKeyboard(
          chatId,
          `📋 Bildirishnomalarni sozlang:`,
          [
            [{ text: `📦 Kam zaxira  ${e(s.notif_low_stock)}`,     callback_data: `notif_toggle:low_stock:${s.notif_low_stock ? 0 : 1}` }],
            [{ text: `📊 Kunlik xulosa  ${e(s.notif_daily_summary)}`, callback_data: `notif_toggle:daily_summary:${s.notif_daily_summary ? 0 : 1}` }],
            [{ text: `🛒 Yangi buyurtmalar  ${e(s.notif_new_orders)}`,  callback_data: `notif_toggle:new_orders:${s.notif_new_orders ? 0 : 1}` }],
            [{ text: `📈 Haftalik hisobot  ${e(s.notif_weekly_report)}`, callback_data: `notif_toggle:weekly_report:${s.notif_weekly_report ? 0 : 1}` }],
            [{ text: '✅ Tayyor — vaqtni sozlash →', callback_data: 'notif_step:time' }],
          ]
        )
      }
    }

    // Onboarding: next step — choose notification time
    if (data === 'notif_step:time') {
      await answerCallbackQuery(cb.id)
      await sendTelegramKeyboard(
        chatId,
        `🕐 Kunlik xulosani qaysi vaqtda olishni xohlaysiz?`,
        [[
          { text: '🌅 Ertalab 8:00',    callback_data: 'notif_time:morning' },
          { text: '☀️ Kunduzi 13:00',   callback_data: 'notif_time:noon'    },
          { text: '🌆 Kechqurun 20:00', callback_data: 'notif_time:evening' },
        ]]
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

    // Step 1: confirm link
    await sendTelegramMessage(
      chatId,
      `✅ <b>Daromadchi hisobingiz ulandi!</b>\n\nEndi qaysi bildirishnomalarni olishni sozlaylik 👇`
    )
    // Step 2: ask which notification types they want
    await sendTelegramKeyboard(
      chatId,
      `📦 Qaysi bildirishnomalarni olishni xohlaysiz?\n\n(Har birini alohida yoqing)`,
      [
        [
          { text: '📦 Kam zaxira ogohlantirishlari ✅', callback_data: 'notif_toggle:low_stock:1' },
        ],
        [
          { text: '📊 Kunlik savdo xulosasi ✅',        callback_data: 'notif_toggle:daily_summary:1' },
        ],
        [
          { text: '🛒 Yangi buyurtmalar ❌',            callback_data: 'notif_toggle:new_orders:0' },
        ],
        [
          { text: '📈 Haftalik hisobot ❌',             callback_data: 'notif_toggle:weekly_report:0' },
        ],
        [
          { text: '✅ Tayyor — vaqtni sozlash →',       callback_data: 'notif_step:time' },
        ],
      ]
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
