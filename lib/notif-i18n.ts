// Localised strings for Telegram notifications (daily/weekly digest + low stock).
// The web UI keeps the chosen language in a cookie, which the cron job cannot
// read, so the language is persisted on user_settings.notif_lang and looked up
// here. Keep these keys in sync with the digest builder in
// app/api/cron/telegram-digest/route.ts.

export type NotifLang = 'uz' | 'ru' | 'en'

// Russian count-noun agreement for «заказ»: 1 заказ, 2–4 заказа, 5+ заказов —
// and 11–14 take the 5+ form regardless of their last digit.
function ruOrders(n: number): string {
  const mod10 = n % 10, mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'новый заказ'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'новых заказа'
  return 'новых заказов'
}

// Technical skip/error reasons, phrased for a seller. One table per language so
// a new reason is added in three places at once rather than three files.
const REASONS: Record<NotifLang, Record<string, string>> = {
  uz: { missing_sku: "tovar identifikatori yo'q", missing_barcode: "shtrix-kod yo'q",
        missing_warehouse: "ombor yo'q", missing_campaign: "kampaniya yo'q", no_token: "token yo'q" },
  ru: { missing_sku: 'нет идентификатора товара', missing_barcode: 'нет штрихкода',
        missing_warehouse: 'нет склада', missing_campaign: 'нет кампании', no_token: 'нет токена' },
  en: { missing_sku: 'no product identifier', missing_barcode: 'no barcode',
        missing_warehouse: 'no warehouse', missing_campaign: 'no campaign', no_token: 'no token' },
}

/** `http_503` -> "<prefix> (HTTP 503)"; anything else passes through raw. */
function httpReason(reason: string, prefix: string): string {
  const m = /^http_(\d+)/.exec(reason)
  return m ? `${prefix} (HTTP ${m[1]})` : reason
}

export function normalizeLang(v: string | null | undefined): NotifLang {
  return v === 'ru' || v === 'en' || v === 'uz' ? v : 'uz'
}

export interface NotifStrings {
  dailyTitle: string
  todayTitle: string
  weeklyTitle: (days: number) => string
  noOrders: string
  orders: string
  revenue: string
  profit: string
  commission: string
  unitsSold: string
  cancelled: string
  byCategory: string
  uncategorized: string
  lowStockTitle: (n: number) => string
  lowStockTotal: string
  lowStockUnit: string
  lowStockDays: (n: number) => string
  lowStockCta: string
  stockUpdateTitle: (n: number) => string
  stockUpdateLine: (product: string, orderMp: string, newQty: number, targetMps: string) => string
  stockUpdateCta: string
  deliveryTitle: (n: number) => string
  // New-order alert. Was built as a hardcoded Uzbek literal in the sync cron and
  // so ignored notif_lang entirely — the one Telegram message that did.
  newOrdersTitle: (n: number) => string
  newOrdersSub: string
  newOrdersLine: (marketplace: string, n: number) => string
  newOrdersMore: (n: number) => string
  newOrdersCta: string
  // Cancellation notice — the closing bracket on the new-order alert. Without
  // it the app tells a seller to pick and pack and never tells them to stop.
  cancelledTitle: (n: number) => string
  cancelledSub: string
  cancelledLine: (marketplace: string, n: number) => string
  cancelledMore: (n: number) => string
  cancelledCta: string
  // Stock-sync digest (lib/marketplace/stock-notify.ts). Was hardcoded Russian.
  stockSyncTitle: string
  stockSyncSoldOn: (marketplace: string) => string
  stockSyncOk: (marketplace: string, from: number, to: number) => string
  stockSyncFailed: (marketplace: string, why: string) => string
  stockSyncRestock: (left: number) => string
  stockSyncReason: (reason: string) => string
  // Read-only manual-stock reminder (lib/marketplace/manual-stock-notify.ts).
  // Tells a read-only seller the exact number to set by hand on a marketplace.
  manualStockTitle: (n: number) => string
  manualStockLine: (product: string, target: number, marketplace: string, orderId?: string | null) => string
  // Closing line: why a human is being asked to do this at all.
  manualStockFooter: string
  // Extension daily summary (app/api/extension/send-daily-summary). Was hardcoded Uzbek.
  extDailyTitle: (date: string) => string
  extRevenue: string
  extProfit: string
  extOrders: string
  extReturned: string
  extLowStock: string
  extUnit: string
  extFooter: string
  // Oversell alerts (lib/marketplace/oversell.ts). Was hardcoded English.
  /** Title + plain-words explanation: the product ran out and this newest order
   *  can't be filled. No stock-vs-orders numbers. First line is the phone-preview. */
  oversellHead: (title: string, lastOrder: string) => string
  oversellAutoCancelOff: string
  oversellNoLaterOrder: string
  oversellRateLimited: (used: number, max: number, mp: string) => string
  oversellCancelling: (mp: string) => string
  deliverTo: string
  deliverBy: string
  fromMarket: string
  fullAnalytics: string
  som: string
  testHeader: string
  testFooter: string
}

const STRINGS: Record<NotifLang, NotifStrings> = {
  uz: {
    dailyTitle:     '📊 <b>Kunlik xulosa (kecha)</b>',
    todayTitle:     '🛒 <b>Bugungi buyurtmalar</b>',
    weeklyTitle:    (d) => `📈 <b>Haftalik hisobot (${d} kun)</b>`,
    noOrders:       "Buyurtmalar yo'q.",
    orders:         'Buyurtmalar',
    revenue:        'Tushum',
    profit:         'Foyda',
    commission:     'Komissiya',
    unitsSold:      'Sotilgan',
    cancelled:      'Bekor',
    byCategory:     'Kategoriyalar bo\'yicha',
    uncategorized:  'Boshqa',
    lowStockTitle:  (n) => `📉 <b>Kam zaxira (${n})</b>`,
    lowStockTotal:  'jami',
    lowStockUnit:   'dona',
    lowStockDays:   (n) => `~${n} kun`,
    lowStockCta:    "Yangi partiya buyurtma qiling yoki reklamani to'xtating.",
    stockUpdateTitle: (n) => `🔄 <b>Zaxirani yangilang (${n})</b>`,
    stockUpdateLine: (product, orderMp, newQty, targetMps) => `• ${product} — buyurtma ${orderMp}, <b>${newQty}</b> qiling: ${targetMps}`,
    stockUpdateCta: "Boshqa do'konlarda qoldiqni yangilang.",
    deliveryTitle:  (n) => `📦 <b>Jarayonda (${n})</b>`,
    newOrdersTitle: (n) => `🛒 <b>Yangi buyurtma${n > 1 ? `lar (${n})` : ''}!</b>`,
    newOrdersSub:   "Yig'ib jo'natish kerak:",
    newOrdersLine:  (mp, n) => `• ${mp}: <b>${n}</b> ta yangi buyurtma`,
    newOrdersMore:  (n) => `…va yana ${n} ta`,
    newOrdersCta:   'Batafsil',
    cancelledTitle: (n) => `❌ <b>Buyurtma bekor qilindi${n > 1 ? ` (${n})` : ''}</b>`,
    cancelledSub:   "Yig'ish shart emas:",
    cancelledLine:  (mp, n) => `• ${mp}: <b>${n}</b> ta bekor qilingan`,
    cancelledMore:  (n) => `…va yana ${n} ta`,
    cancelledCta:   'Batafsil',
    stockSyncTitle: '📦 Qoldiq yangilandi (sotuv):',
    stockSyncSoldOn: (mp) => ` (${mp} da sotildi)`,
    stockSyncOk:    (mp, from, to) => `   ✅ ${mp}: ${from}→${to}`,
    stockSyncFailed:(mp, why) => `   ⚠️ ${mp}: yangilanmadi${why} — qo'lda yangilang`,
    stockSyncRestock: (left) => `   ⚠️ ${left} ta qoldi — omborni to'ldiring`,
    manualStockTitle: (n) => `🔧 <b>Qoldiqni qo'lda yangilang (${n})</b>`,
    manualStockLine:  (product, target, mp, orderId) =>
      `• ${product} — ${mp}da <b>${target}</b> qo'ying${orderId ? ` · buyurtma #${orderId}` : ''}`,
    manualStockFooter: `ℹ️ <i>API kalitlaringiz faqat o'qish rejimida — shuning uchun bu xabar keladi. Tahrirlash huquqi berilsa, qoldiq o'zi yangilanardi.</i>`,
    stockSyncReason: (r) => REASONS.uz[r] ?? httpReason(r, 'API xatosi'),
    extDailyTitle:  (d) => `📊 <b>Kunlik hisobot — ${d}</b>`,
    extRevenue:     '💰 Daromad',
    extProfit:      '📈 Sof foyda',
    extOrders:      '🛒 Buyurtmalar',
    extReturned:    '↩️ Qaytarilgan',
    extLowStock:    '⚠️ <b>Kam zaxira:</b>',
    extUnit:        'dona',
    extFooter:      "daromadchi.uz da to'liq tahlil",
    oversellHead: (title, lastOrder) =>
      `⚠️ <b>Tovar tugadi: ${title}</b>\nYangi buyurtma keldi, lekin boʻsh dona qolmadi — bu tovar allaqachon toʻliq buyurtma qilingan. Buyurtma: ${lastOrder} — bajarishning iloji yoʻq.\nTovarni toʻldiring va Uzum va Yandex hisobingizda qoldiqni yangilang.`,
    oversellAutoCancelOff: "Keraksiz buyurtmani qo'lda bekor qiling.",
    oversellNoLaterOrder:  "Bekor qilish uchun ochiq buyurtma topilmadi — qo'lda tekshiring.",
    oversellRateLimited:   (used, max, mp) => `🚫 Avtomatik bekor qilish chegarasi (${used}/${max} shu soatda). Bekor QILINMADI — ${mp} uchun qo'lda bekor qiling.`,
    oversellCancelling:    (mp) => `🤖 Keyingi buyurtma bekor qilinmoqda (${mp}, sabab OUT_OF_STOCK).`,
    deliverTo:      'PVZ ga',
    deliverBy:      'gacha',
    fromMarket:     'dan',
    fullAnalytics:  "To'liq tahlil",
    som:            "so'm",
    testHeader:     '🔔 <b>Test bildirishnoma</b>\nBu bildirishnomalar to\'g\'ri ishlayotganini tekshirish uchun namuna.',
    testFooter:     'Agar buni ko\'rayotgan bo\'lsangiz — bildirishnomalar ishlayapti ✅',
  },
  ru: {
    dailyTitle:     '📊 <b>Сводка за вчера</b>',
    todayTitle:     '🛒 <b>Заказы за сегодня</b>',
    weeklyTitle:    (d) => `📈 <b>Недельный отчёт (${d} дн.)</b>`,
    noOrders:       'Заказов нет.',
    orders:         'Заказы',
    revenue:        'Выручка',
    profit:         'Прибыль',
    commission:     'Комиссия',
    unitsSold:      'Продано',
    cancelled:      'Отмена',
    byCategory:     'По категориям',
    uncategorized:  'Прочее',
    lowStockTitle:  (n) => `📉 <b>Низкий остаток (${n})</b>`,
    lowStockTotal:  'всего',
    lowStockUnit:   'шт',
    lowStockDays:   (n) => `~${n} дн.`,
    lowStockCta:    'Закажите новую партию или приостановите рекламу.',
    stockUpdateTitle: (n) => `🔄 <b>Обновите остатки (${n})</b>`,
    stockUpdateLine: (product, orderMp, newQty, targetMps) => `• ${product} — заказ ${orderMp}, поставьте <b>${newQty}</b>: ${targetMps}`,
    stockUpdateCta: 'Обновите остатки в других магазинах.',
    deliveryTitle:  (n) => `📦 <b>В процессе (${n})</b>`,
    newOrdersTitle: (n) => n > 1 ? `🛒 <b>Новые заказы (${n})!</b>` : '🛒 <b>Новый заказ!</b>',
    newOrdersSub:   'Нужно собрать и отправить:',
    newOrdersLine:  (mp, n) => `• ${mp}: <b>${n}</b> ${ruOrders(n)}`,
    newOrdersMore:  (n) => `…и ещё ${n}`,
    newOrdersCta:   'Подробнее',
    cancelledTitle: (n) => n > 1 ? `❌ <b>Заказы отменены (${n})</b>` : '❌ <b>Заказ отменён</b>',
    cancelledSub:   'Собирать не нужно:',
    cancelledLine:  (mp, n) => `• ${mp}: <b>${n}</b> ${ruOrders(n)}`,
    cancelledMore:  (n) => `…и ещё ${n}`,
    cancelledCta:   'Подробнее',
    stockSyncTitle: '📦 Остатки обновлены (продажа):',
    stockSyncSoldOn: (mp) => ` (продажа на ${mp})`,
    stockSyncOk:    (mp, from, to) => `   ✅ ${mp}: ${from}→${to}`,
    stockSyncFailed:(mp, why) => `   ⚠️ ${mp}: не обновлён${why} — обновите вручную`,
    stockSyncRestock: (left) => `   ⚠️ Осталось ${left} — пополните склад`,
    manualStockTitle: (n) => `🔧 <b>Обновите остатки вручную (${n})</b>`,
    manualStockLine:  (product, target, mp, orderId) =>
      `• ${product} — поставьте <b>${target}</b> на ${mp}${orderId ? ` · заказ #${orderId}` : ''}`,
    manualStockFooter: `ℹ️ <i>Вы получаете это, потому что ваши API-ключи работают только на чтение. С ключами на редактирование остаток обновился бы сам.</i>`,
    stockSyncReason: (r) => REASONS.ru[r] ?? httpReason(r, 'ошибка API'),
    extDailyTitle:  (d) => `📊 <b>Отчёт за день — ${d}</b>`,
    extRevenue:     '💰 Выручка',
    extProfit:      '📈 Чистая прибыль',
    extOrders:      '🛒 Заказы',
    extReturned:    '↩️ Возвраты',
    extLowStock:    '⚠️ <b>Низкий остаток:</b>',
    extUnit:        'шт',
    extFooter:      'полная аналитика на daromadchi.uz',
    oversellHead: (title, lastOrder) =>
      `⚠️ <b>Товар закончился: ${title}</b>\nПришёл новый заказ, но свободных единиц не осталось — этот товар уже весь заказан. Заказ: ${lastOrder} выполнить нечем.\nПополните товар и обновите остаток на Uzum и Yandex.`,
    oversellAutoCancelOff: 'Отмените лишний заказ вручную, если нужно.',
    oversellNoLaterOrder:  'Не найден открытый заказ для автоотмены — проверьте вручную.',
    oversellRateLimited:   (used, max, mp) => `🚫 Достигнут лимит автоотмены (${used}/${max} за час). НЕ отменяем автоматически — отмените ${mp} вручную.`,
    oversellCancelling:    (mp) => `🤖 Отменяем поздний заказ (${mp}, причина OUT_OF_STOCK).`,
    deliverTo:      'в ПВЗ',
    deliverBy:      'до',
    fromMarket:     'из',
    fullAnalytics:  'Полная аналитика',
    som:            'сум',
    testHeader:     '🔔 <b>Тестовое уведомление</b>\nОбразец, чтобы проверить, что уведомления приходят правильно.',
    testFooter:     'Если вы это видите — уведомления работают ✅',
  },
  en: {
    dailyTitle:     '📊 <b>Daily summary (yesterday)</b>',
    todayTitle:     '🛒 <b>Orders today</b>',
    weeklyTitle:    (d) => `📈 <b>Weekly report (${d} days)</b>`,
    noOrders:       'No orders.',
    orders:         'Orders',
    revenue:        'Revenue',
    profit:         'Profit',
    commission:     'Commission',
    unitsSold:      'Sold',
    cancelled:      'Cancelled',
    byCategory:     'By category',
    uncategorized:  'Other',
    lowStockTitle:  (n) => `📉 <b>Low stock (${n})</b>`,
    lowStockTotal:  'total',
    lowStockUnit:   'pcs',
    lowStockDays:   (n) => `~${n} days`,
    lowStockCta:    'Order a new batch or pause advertising.',
    stockUpdateTitle: (n) => `🔄 <b>Update stock (${n})</b>`,
    stockUpdateLine: (product, orderMp, newQty, targetMps) => `• ${product} — order on ${orderMp}, set to <b>${newQty}</b>: ${targetMps}`,
    stockUpdateCta: 'Update stock in other stores.',
    deliveryTitle:  (n) => `📦 <b>In process (${n})</b>`,
    newOrdersTitle: (n) => n > 1 ? `🛒 <b>New orders (${n})!</b>` : '🛒 <b>New order!</b>',
    newOrdersSub:   'Ready to pick and ship:',
    newOrdersLine:  (mp, n) => `• ${mp}: <b>${n}</b> new order${n === 1 ? '' : 's'}`,
    newOrdersMore:  (n) => `…and ${n} more`,
    newOrdersCta:   'Details',
    cancelledTitle: (n) => n > 1 ? `❌ <b>Orders cancelled (${n})</b>` : '❌ <b>Order cancelled</b>',
    cancelledSub:   'No need to ship:',
    cancelledLine:  (mp, n) => `• ${mp}: <b>${n}</b> cancelled`,
    cancelledMore:  (n) => `…and ${n} more`,
    cancelledCta:   'Details',
    stockSyncTitle: '📦 Stock updated (sale):',
    stockSyncSoldOn: (mp) => ` (sold on ${mp})`,
    stockSyncOk:    (mp, from, to) => `   ✅ ${mp}: ${from}→${to}`,
    stockSyncFailed:(mp, why) => `   ⚠️ ${mp}: not updated${why} — update manually`,
    stockSyncRestock: (left) => `   ⚠️ ${left} left — restock`,
    manualStockTitle: (n) => `🔧 <b>Update stock manually (${n})</b>`,
    manualStockLine:  (product, target, mp, orderId) =>
      `• ${product} — set <b>${target}</b> on ${mp}${orderId ? ` · order #${orderId}` : ''}`,
    manualStockFooter: `ℹ️ <i>You get this because your API keys are read-only. With edit access the stock would have updated on its own.</i>`,
    stockSyncReason: (r) => REASONS.en[r] ?? httpReason(r, 'API error'),
    extDailyTitle:  (d) => `📊 <b>Daily report — ${d}</b>`,
    extRevenue:     '💰 Revenue',
    extProfit:      '📈 Net profit',
    extOrders:      '🛒 Orders',
    extReturned:    '↩️ Returned',
    extLowStock:    '⚠️ <b>Low stock:</b>',
    extUnit:        'pcs',
    extFooter:      'full analytics at daromadchi.uz',
    oversellHead: (title, lastOrder) =>
      `⚠️ <b>Out of stock: ${title}</b>\nA new order came in, but there are no units left — this product is already fully ordered. Order: ${lastOrder} can't be fulfilled.\nRestock and update the quantity on Uzum and Yandex.`,
    oversellAutoCancelOff: 'Cancel the extra order manually if needed.',
    oversellNoLaterOrder:  'No open order found to auto-cancel — please check manually.',
    oversellRateLimited:   (used, max, mp) => `🚫 Auto-cancel rate limit reached (${used}/${max} this hour). NOT auto-cancelling — use one-click cancel for ${mp}.`,
    oversellCancelling:    (mp) => `🤖 Auto-cancelling the later order (${mp}, reason OUT_OF_STOCK).`,
    deliverTo:      'to PVZ',
    deliverBy:      'by',
    fromMarket:     'from',
    fullAnalytics:  'Full analytics',
    som:            'som',
    testHeader:     '🔔 <b>Test notification</b>\nA sample to check that notifications arrive correctly.',
    testFooter:     'If you can see this — notifications are working ✅',
  },
}

export function notifT(lang: string | null | undefined): NotifStrings {
  return STRINGS[normalizeLang(lang)]
}

/** BCP-47 locale for the seller's notification language — dates and numbers. */
export function notifLocale(lang: string | null | undefined): string {
  const l = normalizeLang(lang)
  return l === 'ru' ? 'ru-RU' : l === 'en' ? 'en-US' : 'uz-UZ'
}

export function fmtNumber(n: number, lang: string | null | undefined): string {
  return new Intl.NumberFormat(notifLocale(lang)).format(Math.round(n))
}
