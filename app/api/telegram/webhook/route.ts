import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, botSessions, userSettings, shops } from '@/lib/db'
import { supabaseAdmin } from '@/lib/api/auth'
import { sendTelegramMessage, sendTelegramKeyboard, answerCallbackQuery, editMessageButtons } from '@/lib/telegram'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async () => {
  return NextResponse.json({ ok: true, bot_token_set: !!process.env.TELEGRAM_BOT_TOKEN })
})

type Lang = 'uz' | 'ru' | 'en'

const NOTIF_LABELS: Record<Lang, Record<string, string>> = {
  uz: { morning: '🌅 Ertalab 8:00', noon: '☀️ Kunduzi 13:00', evening: '🌆 Kechqurun 20:00' },
  ru: { morning: '🌅 Утро 8:00',    noon: '☀️ День 13:00',    evening: '🌆 Вечер 20:00' },
  en: { morning: '🌅 Morning 8:00', noon: '☀️ Noon 13:00',    evening: '🌆 Evening 20:00' },
}

const BOT_I18N: Record<Lang, {
  notifPrompt:    string
  lowStock:       string
  dailySummary:   string
  newOrders:      string
  weeklyReport:   string
  timeStep:       string
  timePrompt:     string
  summaryTime:    string
  allSet:         string
  analytics:      string
  linkBad:        string
  linkExpired:    string
  channelNotJoined: (channel: string) => string
  channelConfirmed: string
  activationCode: string
  activationCodeValid: string
  activationExpiry: string
  thanksQuestion: string
}> = {
  uz: {
    notifPrompt:  '⚙️ Bildirishnomalarni sozlang:',
    lowStock:     'Kam zaxira ogohlantirishlari',
    dailySummary: 'Kunlik savdo xulosasi',
    newOrders:    'Yangi buyurtmalar',
    weeklyReport: 'Haftalik hisobot',
    timeStep:     '✅ Tayyor — vaqtni sozlash →',
    timePrompt:   '🕐 Kunlik xulosani qaysi vaqtda olishni xohlaysiz?',
    summaryTime:  'Kunlik hisobot vaqti',
    allSet:       'Hammasi tayyor!',
    analytics:    'Tahlil',
    linkBad:      "❌ Havola noto'g'ri yoki eskirgan. Sozlamalar sahifasidan yangi havola oling.",
    linkExpired:  '⏰ Havola muddati tugagan. Sozlamalar sahifasidan yangi havola oling.',
    channelNotJoined: (c) => `❌ Siz hali <b>${c}</b> kanaliga a'zo emassiz.\n\n1. Kanalga a'zo bo'ling: https://t.me/daromadchi_uz\n2. Keyin yana /activate yuboring.`,
    channelConfirmed: `✅ <b>Tasdiqlandi!</b> Siz @daromadchi_uz kanaliga a'zo ekansiz.\n\nKengaytmaga qayting va "Tekshirish" tugmasini bosing.`,
    activationCode: '✅ <b>Aktivatsiya kodi:</b>',
    activationCodeValid: 'Kodni kengaytmaga kiriting.',
    activationExpiry: 'Kod 30 daqiqa amal qiladi.',
    thanksQuestion: '✅ Savolingiz uchun rahmat! Qabul qildik, tez orada javob beramiz.',
  },
  ru: {
    notifPrompt:  '⚙️ Настройте уведомления:',
    lowStock:     'Предупреждения об остатках',
    dailySummary: 'Ежедневная сводка продаж',
    newOrders:    'Новые заказы',
    weeklyReport: 'Еженедельный отчёт',
    timeStep:     '✅ Готово — настроить время →',
    timePrompt:   '🕐 Когда присылать сводку?',
    summaryTime:  'Время сводки',
    allSet:       'Всё готово!',
    analytics:    'Аналитика',
    linkBad:      '❌ Ссылка неверна или устарела. Получите новую в Настройках.',
    linkExpired:  '⏰ Срок ссылки истёк. Получите новую в Настройках.',
    channelNotJoined: (c) => `❌ Вы ещё не подписаны на канал <b>${c}</b>.\n\n1. Подпишитесь: https://t.me/daromadchi_uz\n2. Затем отправьте /activate ещё раз.`,
    channelConfirmed: `✅ <b>Подтверждено!</b> Вы подписаны на канал @daromadchi_uz.\n\nВернитесь в расширение и нажмите "Проверить".`,
    activationCode: '✅ <b>Код активации:</b>',
    activationCodeValid: 'Введите код в расширение.',
    activationExpiry: 'Код действует 30 минут.',
    thanksQuestion: '✅ Спасибо за ваш вопрос! Мы получили его и ответим в ближайшее время.',
  },
  en: {
    notifPrompt:  '⚙️ Configure notifications:',
    lowStock:     'Low stock alerts',
    dailySummary: 'Daily sales summary',
    newOrders:    'New orders',
    weeklyReport: 'Weekly report',
    timeStep:     '✅ Done — set time →',
    timePrompt:   '🕐 When should I send the summary?',
    summaryTime:  'Summary time',
    allSet:       'All set!',
    analytics:    'Analytics',
    linkBad:      '❌ Link is invalid or expired. Get a new one from Settings.',
    linkExpired:  '⏰ Link expired. Get a new one from Settings.',
    channelNotJoined: (c) => `❌ You're not yet a member of <b>${c}</b>.\n\n1. Join the channel: https://t.me/daromadchi_uz\n2. Then send /activate again.`,
    channelConfirmed: `✅ <b>Confirmed!</b> You're a member of @daromadchi_uz.\n\nReturn to the extension and click "Check".`,
    activationCode: '✅ <b>Activation code:</b>',
    activationCodeValid: 'Enter the code in the extension.',
    activationExpiry: 'Code is valid for 30 minutes.',
    thanksQuestion: '✅ Thank you for your question! We received it and will get back to you soon.',
  },
}

function botT(lang: string | null | undefined) {
  return BOT_I18N[(lang as Lang) in BOT_I18N ? (lang as Lang) : 'uz']
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
  const t = botT(lang)
  await sendTelegramKeyboard(chatId, t.notifPrompt, [
    [{ text: `📦 ${t.lowStock} ✅`,     callback_data: 'notif_toggle:low_stock:1' }],
    [{ text: `📊 ${t.dailySummary} ✅`, callback_data: 'notif_toggle:daily_summary:1' }],
    [{ text: `🛒 ${t.newOrders} ❌`,    callback_data: 'notif_toggle:new_orders:0' }],
    [{ text: `📈 ${t.weeklyReport} ❌`, callback_data: 'notif_toggle:weekly_report:0' }],
    [{ text: t.timeStep,                callback_data: 'notif_step:time' }],
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
        // Persist to userSettings.notif_lang so scheduled digests / test
        // notifications also use the picked language — the whole bot flow
        // now speaks one language chosen once at /start.
        await db.update(userSettings)
          .set({ notif_lang: lang, updated_at: new Date() })
          .where(eq(userSettings.telegram_chat_id, chatId))
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
      const t = botT(lang)
      const timeLabel = NOTIF_LABELS[(lang as Lang) in NOTIF_LABELS ? (lang as Lang) : 'uz'][notifTime] ?? notifTime
      const msg = `✅ ${t.summaryTime}: <b>${timeLabel}</b>\n\n${t.allSet} ${t.analytics}: https://daromadchi.uz/dashboard`
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

      const session = await getSession(chatId)
      const lang = session?.lang ?? 'uz'
      const t = botT(lang)

      const messageId = cb.message?.message_id
      if (messageId) {
        await editMessageButtons(chatId, messageId, [
          [{ text: `📦 ${t.lowStock} ${ls ? '✅' : '❌'}`,     callback_data: `notif_toggle:low_stock:${ls ? '1' : '0'}` }],
          [{ text: `📊 ${t.dailySummary} ${ds ? '✅' : '❌'}`, callback_data: `notif_toggle:daily_summary:${ds ? '1' : '0'}` }],
          [{ text: `🛒 ${t.newOrders} ${no ? '✅' : '❌'}`,    callback_data: `notif_toggle:new_orders:${no ? '1' : '0'}` }],
          [{ text: `📈 ${t.weeklyReport} ${wr ? '✅' : '❌'}`, callback_data: `notif_toggle:weekly_report:${wr ? '1' : '0'}` }],
          [{ text: t.timeStep,                                 callback_data: 'notif_step:time' }],
        ])
      }

      await answerCallbackQuery(cb.id, newVal ? '✅' : '❌')
    }

    if (data === 'notif_step:time') {
      await answerCallbackQuery(cb.id)
      const session = await getSession(chatId)
      const lang = session?.lang ?? 'uz'
      const t = botT(lang)
      const labels = NOTIF_LABELS[(lang as Lang) in NOTIF_LABELS ? (lang as Lang) : 'uz']
      await sendTelegramKeyboard(chatId, t.timePrompt, [[
        { text: labels.morning, callback_data: 'notif_time:morning' },
        { text: labels.noon,    callback_data: 'notif_time:noon'    },
        { text: labels.evening, callback_data: 'notif_time:evening' },
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

    const priorLang = (await getSession(chatId))?.lang ?? 'uz'
    const tStart = botT(priorLang)
    if (!settings) {
      await sendTelegramMessage(chatId, tStart.linkBad)
      return NextResponse.json({ ok: true })
    }
    if (settings.telegram_link_expires_at && new Date(settings.telegram_link_expires_at) < new Date()) {
      await sendTelegramMessage(chatId, tStart.linkExpired)
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
    const activateLang = (await getSession(chatId))?.lang ?? 'uz'
    const tAct = botT(activateLang)
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
      await sendTelegramMessage(chatId, tAct.channelNotJoined(CHANNEL))
      return NextResponse.json({ ok: true })
    }
    const code = Math.random().toString(36).slice(2, 6).toUpperCase() +
                 '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    await supabaseAdmin.from('ext_activation_codes').upsert({ code, chat_id: chatId, used: false, expires_at: expiresAt })
    await sendTelegramMessage(chatId,
      `${tAct.activationCode}\n\n<code>${code}</code>\n\n${tAct.activationCodeValid}\n<i>${tAct.activationExpiry}</i>`
    )
    return NextResponse.json({ ok: true })
  }

  // ── free text — forward as question to admin ──────────────────────────────
  const session = await getSession(chatId)
  const lang = session?.lang ?? 'uz'
  const firstName = (message.from?.first_name as string | undefined) ?? ''
  const uname     = (message.from?.username  as string | undefined) ?? ''
  const senderInfo = [firstName, uname ? `@${uname}` : '', `(ID: ${chatId})`].filter(Boolean).join(' ')
  await sendTelegramMessage(chatId, botT(lang).thanksQuestion)
  await sendTelegramMessage('6884517020',
    `📩 <b>Yangi savol / Новый вопрос</b>\n\n👤 ${senderInfo}\n\n💬 ${text}`
  )

  return NextResponse.json({ ok: true })
})
