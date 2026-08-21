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

export function normalizeLang(v: string | null | undefined): NotifLang {
  return v === 'ru' || v === 'en' || v === 'uz' ? v : 'uz'
}

interface NotifStrings {
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
    newOrdersTitle: (n) => n > 1 ? `🛒 <b>Новые заказы (${n})</b>` : '🛒 <b>Новый заказ</b>',
    newOrdersSub:   'Нужно собрать и отправить:',
    newOrdersLine:  (mp, n) => `• ${mp}: <b>${n}</b> ${ruOrders(n)}`,
    newOrdersMore:  (n) => `…и ещё ${n}`,
    newOrdersCta:   'Подробнее',
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
    newOrdersTitle: (n) => n > 1 ? `🛒 <b>New orders (${n})</b>` : '🛒 <b>New order</b>',
    newOrdersSub:   'Ready to pick and ship:',
    newOrdersLine:  (mp, n) => `• ${mp}: <b>${n}</b> new order${n === 1 ? '' : 's'}`,
    newOrdersMore:  (n) => `…and ${n} more`,
    newOrdersCta:   'Details',
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

export function fmtNumber(n: number, lang: string | null | undefined): string {
  const loc = normalizeLang(lang) === 'ru' ? 'ru-RU' : normalizeLang(lang) === 'en' ? 'en-US' : 'uz-UZ'
  return new Intl.NumberFormat(loc).format(Math.round(n))
}
