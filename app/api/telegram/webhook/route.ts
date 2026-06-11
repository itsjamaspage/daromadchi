import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/api/auth'
import { sendTelegramMessage, sendTelegramKeyboard, answerCallbackQuery } from '@/lib/telegram'

// Register via: GET https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://daromadchi.uz/api/telegram/webhook
// Always return 200 so Telegram doesn't retry.

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  return NextResponse.json({
    ok: true,
    bot_token_set: !!token,
    token_preview: token ? token.split(':')[0] + ':***' : null,
  })
}

const NOTIF_LABELS: Record<string, string> = {
  morning: '🌅 Ertalab 8:00',
  noon:    '☀️ Kunduzi 13:00',
  evening: '🌆 Kechqurun 20:00',
}

// ── Bot onboarding copy ────────────────────────────────────────────────────────
const WELCOME: Record<string, string> = {
  uz: `📊 <b>Daromadchi Alerts</b> — do'koningiz uchun aqlli yordamchi.

Men nima qilaman:
• 📦 Zaxira kamaysa — ogohlantiraman
• 📊 Har kuni savdo xulosasi — sotuvlar, buyurtmalar, daromad
• 🛒 Yangi buyurtmalar haqida xabar

🔒 <b>Ma'lumotlar xavfsizligi:</b>
Faqat do'kon nomi, marketpleysi va bildirishnoma sozlamalari saqlanadi. Ma'lumotlar shifrlanib saqlanadi va uchinchi shaxslarga berilmaydi.

Do'koningiz yoki brendingiz nomini yozing 👇`,

  ru: `📊 <b>Daromadchi Alerts</b> — умный помощник для вашего магазина.

Что я делаю:
• 📦 Предупреждаю об остатках товаров
• 📊 Ежедневная сводка — продажи, заказы, доход
• 🛒 Уведомляю о новых заказах

🔒 <b>Безопасность данных:</b>
Хранятся только название магазина, маркетплейс и настройки уведомлений. Данные зашифрованы и не передаются третьим лицам.

Напишите название вашего магазина или бренда 👇`,

  en: `📊 <b>Daromadchi Alerts</b> — smart assistant for your store.

What I do:
• 📦 Alert you when stock runs low
• 📊 Daily summary — sales, orders, revenue
• 🛒 Notify you about new orders

🔒 <b>Data security:</b>
Only your store name, marketplace, and notification preferences are stored. Data is encrypted and never shared with third parties.

Write your store or brand name 👇`,
}

const MKT_QUESTION: Record<string, string> = {
  uz: '🛍 Qaysi marketpleysda sotyapsiz?',
  ru: '🛍 На каком маркетплейсе вы продаёте?',
  en: '🛍 Which marketplace do you sell on?',
}

const MKT_BUTTONS: Record<string, { text: string; data: string }[]> = {
  uz: [
    { text: '🟣 Uzum Market',   data: 'mkt:uzum' },
    { text: '🟣 Wildberries',   data: 'mkt:wb'   },
    { text: '🟡 Yandex Market', data: 'mkt:ym'   },
    { text: '🌐 Barcha platformalar', data: 'mkt:all' },
  ],
  ru: [
    { text: '🟣 Uzum Market',   data: 'mkt:uzum' },
    { text: '🟣 Wildberries',   data: 'mkt:wb'   },
    { text: '🟡 Yandex Market', data: 'mkt:ym'   },
    { text: '🌐 Все платформы', data: 'mkt:all'  },
  ],
  en: [
    { text: '🟣 Uzum Market',   data: 'mkt:uzum' },
    { text: '🟣 Wildberries',   data: 'mkt:wb'   },
    { text: '🟡 Yandex Market', data: 'mkt:ym'   },
    { text: '🌐 All platforms', data: 'mkt:all'  },
  ],
}

const DONE_MSG: Record<string, (shopName: string) => string> = {
  uz: (n) => `✅ <b>Siz ro'yxatdan o'tdingiz!</b>

🏪 Do'kon: <b>${n}</b>

To'liq tahlil va hisobotlar uchun daromadchi.uz ga kiring va Telegram hisobingizni ulan (Sozlamalar → Telegram).

Bildirishnomalar yoqildi. Davom eting! 🚀`,

  ru: (n) => `✅ <b>Вы зарегистрированы!</b>

🏪 Магазин: <b>${n}</b>

Для полной аналитики войдите на daromadchi.uz и подключите Telegram-аккаунт (Настройки → Telegram).

Уведомления включены. Вперёд! 🚀`,

  en: (n) => `✅ <b>You're all set!</b>

🏪 Store: <b>${n}</b>

For full analytics, log in to daromadchi.uz and link your Telegram account (Settings → Telegram).

Notifications are on. Let's go! 🚀`,
}

async function getSession(chatId: string) {
  const { data } = await supabaseAdmin
    .from('bot_sessions')
    .select('*')
    .eq('chat_id', chatId)
    .maybeSingle()
  return data as { chat_id: string; lang: string; step: string; shop_name: string | null; marketplace: string | null } | null
}

async function upsertSession(chatId: string, fields: Record<string, unknown>) {
  await supabaseAdmin.from('bot_sessions').upsert({
    chat_id: chatId,
    updated_at: new Date().toISOString(),
    ...fields,
  })
}

async function sendLangSelect(chatId: string) {
  await sendTelegramKeyboard(
    chatId,
    '🌐 Tilni tanlang / Выберите язык / Choose language:',
    [[
      { text: "🇺🇿 O'zbek",    callback_data: 'lang:uz' },
      { text: '🇷🇺 Русский',  callback_data: 'lang:ru' },
      { text: '🇬🇧 English',  callback_data: 'lang:en' },
    ]]
  )
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expectedSecret) {
    const got = req.headers.get('x-telegram-bot-api-secret-token')
    if (got !== expectedSecret) return NextResponse.json({ ok: true })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  // ── callback_query ─────────────────────────────────────────────────────────
  if (body.callback_query) {
    const cb     = body.callback_query
    const chatId = String(cb.message?.chat?.id ?? cb.from?.id)
    const data   = (cb.data ?? '') as string

    // ── Language selection (onboarding step 1) ──
    if (data.startsWith('lang:')) {
      const lang = data.replace('lang:', '') as 'uz' | 'ru' | 'en'
      await upsertSession(chatId, { lang, step: 'await_name' })
      await answerCallbackQuery(cb.id)
      await sendTelegramMessage(chatId, WELCOME[lang] ?? WELCOME.uz)
      return NextResponse.json({ ok: true })
    }

    // ── Marketplace selection (onboarding step 3) ──
    if (data.startsWith('mkt:')) {
      const marketplace = data.replace('mkt:', '')
      const session = await getSession(chatId)
      const lang = session?.lang ?? 'uz'
      const shopName = session?.shop_name ?? '—'
      await upsertSession(chatId, { marketplace, step: 'done' })
      await answerCallbackQuery(cb.id, '✅')
      await sendTelegramMessage(chatId, DONE_MSG[lang]?.(shopName) ?? DONE_MSG.uz(shopName))
      return NextResponse.json({ ok: true })
    }

    // ── Notification time ──
    if (data.startsWith('notif_time:')) {
      const notifTime = data.replace('notif_time:', '')
      const sendTimeMap: Record<string, string> = {
        morning: '08:00',
        noon:    '13:00',
        evening: '20:00',
      }
      const sendTime = sendTimeMap[notifTime] ?? '09:00'
      await supabaseAdmin
        .from('user_settings')
        .update({ notification_time: notifTime, notif_send_time: sendTime, updated_at: new Date().toISOString() })
        .eq('telegram_chat_id', chatId)
      await answerCallbackQuery(cb.id, '✅ Saqlandi!')
      await sendTelegramMessage(chatId,
        `✅ Kunlik hisobot vaqti: <b>${NOTIF_LABELS[notifTime] ?? notifTime}</b> ga sozlandi.\n\nTo'liq tahlil: https://daromadchi.uz/dashboard`
      )
    }

    // ── Notification toggle ──
    if (data.startsWith('notif_toggle:')) {
      const [, field, val] = data.split(':')
      const colMap: Record<string, string> = {
        low_stock:     'notif_low_stock',
        daily_summary: 'notif_daily_summary',
        new_orders:    'notif_new_orders',
        weekly_report: 'notif_weekly_report',
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
        const { data: s } = await supabaseAdmin
          .from('user_settings')
          .select('notif_low_stock, notif_daily_summary, notif_new_orders, notif_weekly_report')
          .eq('telegram_chat_id', chatId)
          .maybeSingle()
        const st = s ?? { notif_low_stock: true, notif_daily_summary: true, notif_new_orders: false, notif_weekly_report: false }
        const e = (v: boolean | null | undefined) => v ? '✅' : '❌'
        await sendTelegramKeyboard(chatId, `📋 Bildirishnomalarni sozlang:`, [
          [{ text: `📦 Kam zaxira  ${e(st.notif_low_stock)}`,      callback_data: `notif_toggle:low_stock:${st.notif_low_stock ? 0 : 1}` }],
          [{ text: `📊 Kunlik xulosa  ${e(st.notif_daily_summary)}`,callback_data: `notif_toggle:daily_summary:${st.notif_daily_summary ? 0 : 1}` }],
          [{ text: `🛒 Yangi buyurtmalar  ${e(st.notif_new_orders)}`, callback_data: `notif_toggle:new_orders:${st.notif_new_orders ? 0 : 1}` }],
          [{ text: `📈 Haftalik hisobot  ${e(st.notif_weekly_report)}`, callback_data: `notif_toggle:weekly_report:${st.notif_weekly_report ? 0 : 1}` }],
          [{ text: '✅ Tayyor — vaqtni sozlash →', callback_data: 'notif_step:time' }],
        ])
      }
    }

    if (data === 'notif_step:time') {
      await answerCallbackQuery(cb.id)
      await sendTelegramKeyboard(chatId, `🕐 Kunlik xulosani qaysi vaqtda olishni xohlaysiz?`, [[
        { text: '🌅 Ertalab 8:00',    callback_data: 'notif_time:morning' },
        { text: '☀️ Kunduzi 13:00',   callback_data: 'notif_time:noon'    },
        { text: '🌆 Kechqurun 20:00', callback_data: 'notif_time:evening' },
      ]])
    }

    return NextResponse.json({ ok: true })
  }

  // ── regular message ────────────────────────────────────────────────────────
  const message = body.message
  if (!message?.text) return NextResponse.json({ ok: true })

  const chatId   = String(message.chat.id)
  const username = (message.from?.username as string | undefined) ?? null
  const text     = (message.text as string).trim()

  // /start {token} — link dashboard account
  if (text.startsWith('/start ') || text.startsWith('/start@')) {
    const token = text.split(' ')[1]?.trim()

    // chancheck_{nonce} — extension channel gate
    if (token?.startsWith('chancheck_')) {
      const nonce = token.replace('chancheck_', '')
      const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
      const CHANNEL   = '@daromadchi_uz'
      let isMember = false
      try {
        const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHANNEL, user_id: message.from.id }),
        })
        const d = await r.json()
        isMember = ['member', 'administrator', 'creator'].includes(d?.result?.status)
      } catch {}

      if (!isMember) {
        await sendTelegramMessage(chatId,
          `❌ Siz hali <b>${CHANNEL}</b> kanaliga a'zo emassiz.\n\n` +
          `Kanalga kiring: https://t.me/daromadchi_uz\n` +
          `Keyin kengaytmadagi "Tekshirish" tugmasini bosing.`
        )
      } else {
        await supabaseAdmin
          .from('channel_nonces')
          .update({ verified: true, telegram_id: String(message.from.id) })
          .eq('nonce', nonce)
          .gt('expires_at', new Date().toISOString())
        await sendTelegramMessage(chatId,
          `✅ <b>Tasdiqlandi!</b> Siz @daromadchi_uz kanaliga a'zo ekansiz.\n\nKengaytmaga qayting va "Tekshirish" tugmasini bosing.`
        )
      }
      return NextResponse.json({ ok: true })
    }

    // Account link token
    if (!token) {
      await sendLangSelect(chatId)
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

    await sendTelegramMessage(chatId, `✅ <b>Daromadchi hisobingiz ulandi!</b>\n\nEndi qaysi bildirishnomalarni olishni sozlaylik 👇`)
    await sendTelegramKeyboard(chatId, `📦 Qaysi bildirishnomalarni olishni xohlaysiz?`, [
      [{ text: '📦 Kam zaxira ogohlantirishlari ✅', callback_data: 'notif_toggle:low_stock:1' }],
      [{ text: '📊 Kunlik savdo xulosasi ✅',        callback_data: 'notif_toggle:daily_summary:1' }],
      [{ text: '🛒 Yangi buyurtmalar ❌',            callback_data: 'notif_toggle:new_orders:0' }],
      [{ text: '📈 Haftalik hisobot ❌',             callback_data: 'notif_toggle:weekly_report:0' }],
      [{ text: '✅ Tayyor — vaqtni sozlash →',       callback_data: 'notif_step:time' }],
    ])
    return NextResponse.json({ ok: true })
  }

  // /activate — extension activation
  if (text === '/activate') {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
    const CHANNEL   = '@daromadchi_uz'
    let isMember = false
    try {
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHANNEL, user_id: message.from.id }),
      })
      const d = await r.json()
      isMember = ['member', 'administrator', 'creator'].includes(d?.result?.status)
    } catch {}

    if (!isMember) {
      await sendTelegramMessage(chatId,
        `❌ Siz hali <b>${CHANNEL}</b> kanaliga a'zo emassiz.\n\n1. Kanalga a'zo bo'ling: https://t.me/daromadchi_uz\n2. Keyin yana /activate yuboring.`
      )
      return NextResponse.json({ ok: true })
    }
    const code = Math.random().toString(36).slice(2, 6).toUpperCase() +
                 '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    await supabaseAdmin.from('ext_activation_codes').upsert({ code, chat_id: chatId, used: false, expires_at: expiresAt })
    await sendTelegramMessage(chatId,
      `✅ <b>Aktivatsiya kodi:</b>\n\n<code>${code}</code>\n\nKodni kengaytmaga kiriting.\n<i>Kod 30 daqiqa amal qiladi.</i>`
    )
    return NextResponse.json({ ok: true })
  }

  // ── Check onboarding state for text messages ───────────────────────────────
  if (text !== '/start') {
    const session = await getSession(chatId)
    if (session?.step === 'await_name') {
      // Save shop name, ask marketplace
      const lang = session.lang ?? 'uz'
      await upsertSession(chatId, { shop_name: text, step: 'await_marketplace' })
      await sendTelegramKeyboard(
        chatId,
        MKT_QUESTION[lang] ?? MKT_QUESTION.uz,
        MKT_BUTTONS[lang]?.map(b => [{ text: b.text, callback_data: b.data }]) ?? []
      )
      return NextResponse.json({ ok: true })
    }
  }

  // /start (bare) — begin onboarding with language selection
  if (text === '/start') {
    await upsertSession(chatId, { step: 'lang_select', shop_name: null, marketplace: null })
    await sendLangSelect(chatId)
  }

  return NextResponse.json({ ok: true })
}
