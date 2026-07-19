// Localised strings for Telegram notifications (daily/weekly digest + low stock).
// The web UI keeps the chosen language in a cookie, which the cron job cannot
// read, so the language is persisted on user_settings.notif_lang and looked up
// here. Keep these keys in sync with the digest builder in
// app/api/cron/telegram-digest/route.ts.

export type NotifLang = 'uz' | 'ru' | 'en'

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
  unitsSold: string
  cancelled: string
  byCategory: string
  uncategorized: string
  lowStockTitle: (n: number) => string
  lowStockTotal: string
  lowStockUnit: string
  lowStockDays: (n: number) => string
  lowStockCta: string
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
    unitsSold:      'Sotilgan mahsulot',
    cancelled:      'Bekor qilingan',
    byCategory:     'Kategoriyalar bo\'yicha',
    uncategorized:  'Boshqa',
    lowStockTitle:  (n) => `📉 <b>Kam zaxira (${n})</b>`,
    lowStockTotal:  'jami',
    lowStockUnit:   'dona',
    lowStockDays:   (n) => `~${n} kun`,
    lowStockCta:    "Yangi partiya buyurtma qiling yoki reklamani to'xtating.",
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
    unitsSold:      'Продано товаров',
    cancelled:      'Отменённые',
    byCategory:     'По категориям',
    uncategorized:  'Прочее',
    lowStockTitle:  (n) => `📉 <b>Низкий остаток (${n})</b>`,
    lowStockTotal:  'всего',
    lowStockUnit:   'шт',
    lowStockDays:   (n) => `~${n} дн.`,
    lowStockCta:    'Закажите новую партию или приостановите рекламу.',
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
    unitsSold:      'Units sold',
    cancelled:      'Cancelled',
    byCategory:     'By category',
    uncategorized:  'Other',
    lowStockTitle:  (n) => `📉 <b>Low stock (${n})</b>`,
    lowStockTotal:  'total',
    lowStockUnit:   'pcs',
    lowStockDays:   (n) => `~${n} days`,
    lowStockCta:    'Order a new batch or pause advertising.',
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
