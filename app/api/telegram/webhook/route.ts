import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, botSessions, userSettings, shops } from '@/lib/db'
import { supabaseAdmin } from '@/lib/api/auth'
import { sendTelegramMessage, sendTelegramKeyboard, answerCallbackQuery, editMessageButtons } from '@/lib/telegram'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async () => {
  return NextResponse.json({ ok: true, bot_token_set: !!process.env.TELEGRAM_BOT_TOKEN })
})

const NOTIF_LABELS: Record<string, string> = {
  morning: '🌅 Ertalab 8:00',
  noon:    '☀️ Kunduzi 13:00',
  evening: '🌆 Kechqurun 20:00',
}

const MKT_NAMES: Record<string, string> = {
  uzum:          '🟣 Uzum Market',
  yandex_market: '🟡 Yandex Market',
  wildberries:   '🟣 Wildberries',
}

const WELCOME_UNLINKED: Record<string, string> = {
  uz: `👋 <b>Daromadchi Alerts</b> ga xush kelibsiz!

Men sizning do'koningiz uchun aqlli yordamchiman:

📦 Zaxira kamaysa — ogohlantiraman
📊 Har kuni savdo xulosasi yuboraman
🛒 Yangi buyurtmalar haqida xabar beraman
📈 Haftalik hisobot tayyorlayman

<b>Boshlash uchun:</b>
1️⃣ <a href="https://daromadchi.uz">daromadchi.uz</a> da ro'yxatdan o'ting
2️⃣ Sozlamalar sahifasida API kalitlarini ulang
3️⃣ "Telegram ulash" tugmasini bosing

Shundan keyin men avtomatik ravishda do'konlaringizni topaman va bildirishnomalarni yoqaman! 🚀`,

  ru: `👋 Добро пожаловать в <b>Daromadchi Alerts</b>!

Я умный помощник для вашего магазина:

📦 Предупреждаю когда заканчиваются остатки
📊 Ежедневная сводка продаж
🛒 Уведомления о новых заказах
📈 Еженедельные отчёты

<b>Чтобы начать:</b>
1️⃣ Зарегистрируйтесь на <a href="https://daromadchi.uz">daromadchi.uz</a>
2️⃣ Подключите API-ключи в Настройках
3️⃣ Нажмите "Подключить Telegram"

После этого я автоматически найду ваши магазины и включу уведомления! 🚀`,

  en: `👋 Welcome to <b>Daromadchi Alerts</b>!

I'm a smart assistant for your store:

📦 Alert you when stock runs low
📊 Daily sales summary
🛒 New order notifications
📈 Weekly reports

<b>To get started:</b>
1️⃣ Sign up at <a href="https://daromadchi.uz">daromadchi.uz</a>
2️⃣ Connect your API keys in Settings
3️⃣ Click "Link Telegram"

After that I'll automatically find your stores and turn on notifications! 🚀`,
}

function buildLinkedWelcome(lang: string, shopList: { name: string; marketplace: string }[]): string {
  const shopLines = shopList
    .map(s => `  ${MKT_NAMES[s.marketplace] ?? s.marketplace} — <b>${s.name}</b>`)
    .join('\n')

  if (lang === 'ru') {
    return `✅ <b>Telegram подключён к Daromadchi!</b>

🏪 <b>Ваши магазины:</b>
${shopLines || '  Магазины не найдены'}

Теперь вы будете получать:
📦 Предупреждения об остатках
📊 Ежедневную сводку продаж
🛒 Уведомления о новых заказах

Уведомления включены. Вперёд! 🚀`
  }

  if (lang === 'en') {
    return `✅ <b>Telegram connected to Daromadchi!</b>

🏪 <b>Your stores:</b>
${shopLines || '  No stores found'}

You will now receive:
📦 Low stock alerts
📊 Daily sales summary
🛒 New order notifications

Notifications are on. Let's go! 🚀`
  }

  return `✅ <b>Telegram Daromadchi ga ulandi!</b>

🏪 <b>Sizning do'konlaringiz:</b>
${shopLines || "  Do'konlar topilmadi"}

Endi siz quyidagilarni olasiz:
📦 Kam zaxira ogohlantirishlari
📊 Kunlik savdo xulosasi
🛒 Yangi buyurtma xabarlari

Bildirishnomalar yoqildi. Davom eting! 🚀`
}

async function getSession(chatId: string) {
  const [data] = await db.select().from(botSessions).where(eq(botSessions.chat_id, chatId))
  return data as { chat_id: string; lang: string; step: string; user_id: string | null; shop_name: string | null; marketplace: string | null } | null
}

async function upsertSession(chatId: string, fields: Record<string, unknown>) {
  await db.insert(botSessions).values({
    chat_id: chatId,
    updated_at: new Date(),
    ...fields,
  }).onConflictDoUpdate({
    target: botSessions.chat_id,
    set: {
      updated_at: new Date(),
      ...fields,
    },
  })
}

async function getUserShops(userId: string) {
  return db.select({ name: shops.name, marketplace: shops.marketplace })
    .from(shops)
    .where(eq(shops.user_id, userId))
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

async function sendNotifSettings(chatId: string, lang: string) {
  const q = lang === 'ru'
    ? '⚙️ Настройте уведомления:'
    : lang === 'en'
    ? '⚙️ Configure notifications:'
    : '⚙️ Bildirishnomalarni sozlang:'
  await sendTelegramKeyboard(chatId, q, [
    [{ text: '📦 Kam zaxira ogohlantirishlari ✅', callback_data: 'notif_toggle:low_stock:1' }],
    [{ text: '📊 Kunlik savdo xulosasi ✅',        callback_data: 'notif_toggle:daily_summary:1' }],
    [{ text: '🛒 Yangi buyurtmalar ❌',            callback_data: 'notif_toggle:new_orders:0' }],
    [{ text: '📈 Haftalik hisobot ❌',             callback_data: 'notif_toggle:weekly_report:0' }],
    [{ text: '✅ Tayyor — vaqtni sozlash →',       callback_data: 'notif_step:time' }],
  ])
}

export const POST = withErrorHandler(async (req: NextRequest) => {
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

    if (data.startsWith('lang:')) {
      const lang = data.replace('lang:', '') as 'uz' | 'ru' | 'en'
      await answerCallbackQuery(cb.id)

      const [linked] = await db.select({ user_id: userSettings.user_id })
        .from(userSettings)
        .where(eq(userSettings.telegram_chat_id, chatId))

      if (linked) {
        const userShops = await getUserShops(linked.user_id)
        await upsertSession(chatId, { lang, step: 'done', user_id: linked.user_id })
        await sendTelegramMessage(chatId, buildLinkedWelcome(lang, userShops))
        await sendNotifSettings(chatId, lang)
      } else {
        await upsertSession(chatId, { lang, step: 'done' })
        await sendTelegramMessage(chatId, WELCOME_UNLINKED[lang] ?? WELCOME_UNLINKED.uz)
      }
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('notif_time:')) {
      const notifTime = data.replace('notif_time:', '')
      const sendTimeMap: Record<string, string> = { morning: '08:00', noon: '13:00', evening: '20:00' }
      const sendTime = sendTimeMap[notifTime] ?? '09:00'
      await db.update(userSettings)
        .set({ notif_send_time: sendTime, updated_at: new Date() })
        .where(eq(userSettings.telegram_chat_id, chatId))
      await answerCallbackQuery(cb.id, '✅')
      const session = await getSession(chatId)
      const lang = session?.lang ?? 'uz'
      const timeLabel = NOTIF_LABELS[notifTime] ?? notifTime
      const msg = lang === 'ru'
        ? `✅ Время сводки: <b>${timeLabel}</b>\n\nВсё готово! Аналитика: https://daromadchi.uz/dashboard`
        : lang === 'en'
        ? `✅ Summary time: <b>${timeLabel}</b>\n\nAll set! Analytics: https://daromadchi.uz/dashboard`
        : `✅ Kunlik hisobot vaqti: <b>${timeLabel}</b>\n\nHammasi tayyor! Tahlil: https://daromadchi.uz/dashboard`
      await sendTelegramMessage(chatId, msg)
    }

    if (data.startsWith('notif_toggle:')) {
      const parts = data.split(':')
      const key = parts[1] as 'low_stock' | 'daily_summary' | 'new_orders' | 'weekly_report'
      const currentVal = parts[2] === '1'
      const newVal = !currentVal

      const dbFieldMap: Record<string, 'notif_low_stock' | 'notif_daily_summary' | 'notif_new_orders' | 'notif_weekly_report'> = {
        low_stock:     'notif_low_stock',
        daily_summary: 'notif_daily_summary',
        new_orders:    'notif_new_orders',
        weekly_report: 'notif_weekly_report',
      }
      const dbField = dbFieldMap[key]

      if (dbField) {
        await db.update(userSettings)
          .set({ [dbField]: newVal, updated_at: new Date() })
          .where(eq(userSettings.telegram_chat_id, chatId))
      }

      const [row] = await db.select({
        ls: userSettings.notif_low_stock,
        ds: userSettings.notif_daily_summary,
        no: userSettings.notif_new_orders,
        wr: userSettings.notif_weekly_report,
      }).from(userSettings).where(eq(userSettings.telegram_chat_id, chatId))

      const ls = row?.ls ?? true, ds = row?.ds ?? true, no = row?.no ?? false, wr = row?.wr ?? false

      const messageId = cb.message?.message_id
      if (messageId) {
        await editMessageButtons(chatId, messageId, [
          [{ text: `📦 Kam zaxira ogohlantirishlari ${ls ? '✅' : '❌'}`, callback_data: `notif_toggle:low_stock:${ls ? '1' : '0'}` }],
          [{ text: `📊 Kunlik savdo xulosasi ${ds ? '✅' : '❌'}`,        callback_data: `notif_toggle:daily_summary:${ds ? '1' : '0'}` }],
          [{ text: `🛒 Yangi buyurtmalar ${no ? '✅' : '❌'}`,            callback_data: `notif_toggle:new_orders:${no ? '1' : '0'}` }],
          [{ text: `📈 Haftalik hisobot ${wr ? '✅' : '❌'}`,             callback_data: `notif_toggle:weekly_report:${wr ? '1' : '0'}` }],
          [{ text: '✅ Tayyor — vaqtni sozlash →',                        callback_data: 'notif_step:time' }],
        ])
      }

      await answerCallbackQuery(cb.id, newVal ? '✅' : '❌')
    }

    if (data === 'notif_step:time') {
      await answerCallbackQuery(cb.id)
      const session = await getSession(chatId)
      const lang = session?.lang ?? 'uz'
      const q = lang === 'ru'
        ? '🕐 Когда присылать сводку?'
        : lang === 'en'
        ? '🕐 When should I send the summary?'
        : '🕐 Kunlik xulosani qaysi vaqtda olishni xohlaysiz?'
      await sendTelegramKeyboard(chatId, q, [[
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

  // ── /start <token> — user came from Settings "Telegram ulash" button ──────
  if (text.startsWith('/start ') || text.startsWith('/start@')) {
    const token = text.split(' ')[1]?.trim()

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

    if (!token) {
      await sendLangSelect(chatId)
      return NextResponse.json({ ok: true })
    }

    const [settings] = await db.select({
      user_id: userSettings.user_id,
      telegram_link_expires_at: userSettings.telegram_link_expires_at,
    }).from(userSettings)
      .where(eq(userSettings.telegram_link_token, token))

    if (!settings) {
      await sendTelegramMessage(chatId, '❌ Havola noto\'g\'ri yoki eskirgan. Sozlamalar sahifasidan yangi havola oling.')
      return NextResponse.json({ ok: true })
    }
    if (settings.telegram_link_expires_at && new Date(settings.telegram_link_expires_at) < new Date()) {
      await sendTelegramMessage(chatId, '⏰ Havola muddati tugagan. Sozlamalar sahifasidan yangi havola oling.')
      return NextResponse.json({ ok: true })
    }

    await db.update(userSettings).set({
      telegram_chat_id:         chatId,
      telegram_username:        username,
      telegram_link_token:      null,
      telegram_link_expires_at: null,
      updated_at:               new Date(),
    }).where(eq(userSettings.user_id, settings.user_id))

    const userShops = await getUserShops(settings.user_id)
    await upsertSession(chatId, { user_id: settings.user_id, step: 'done', lang: 'uz' })

    await sendLangSelect(chatId)
    return NextResponse.json({ ok: true })
  }

  // ── /start (no token) — random user or returning user ─────────────────────
  if (text === '/start') {
    const [alreadyLinked] = await db.select({ user_id: userSettings.user_id })
      .from(userSettings)
      .where(eq(userSettings.telegram_chat_id, chatId))

    if (alreadyLinked) {
      await upsertSession(chatId, { user_id: alreadyLinked.user_id, step: 'lang_select' })
    } else {
      await upsertSession(chatId, { step: 'lang_select', shop_name: null, marketplace: null })
    }
    await sendLangSelect(chatId)
    return NextResponse.json({ ok: true })
  }

  // ── /activate — extension activation code ─────────────────────────────────
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

  // ── free text — forward as question to admin ──────────────────────────────
  const session = await getSession(chatId)
  const lang = session?.lang ?? 'uz'
  const firstName = (message.from?.first_name as string | undefined) ?? ''
  const uname     = (message.from?.username  as string | undefined) ?? ''
  const senderInfo = [firstName, uname ? `@${uname}` : '', `(ID: ${chatId})`].filter(Boolean).join(' ')
  const thanks = lang === 'ru'
    ? '✅ Спасибо за ваш вопрос! Мы получили его и ответим в ближайшее время.'
    : lang === 'en'
    ? '✅ Thank you for your question! We received it and will get back to you soon.'
    : '✅ Savolingiz uchun rahmat! Qabul qildik, tez orada javob beramiz.'
  await sendTelegramMessage(chatId, thanks)
  await sendTelegramMessage('6884517020',
    `📩 <b>Yangi savol / Новый вопрос</b>\n\n👤 ${senderInfo}\n\n💬 ${text}`
  )

  return NextResponse.json({ ok: true })
})
