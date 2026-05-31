import type { Lang } from './i18n'

export const dashT = {
  uz: {
    nav: {
      dashboard: 'Dashboard', products: 'Mahsulotlar', orders: 'Buyurtmalar',
      analytics: 'Tahlil', pnl: 'F & Z hisobot', calculator: 'Kalkulyator',
      market: 'Bozor tadqiqoti', settings: 'Sozlamalar', profile: 'Profil', logout: 'Chiqish',
      store: "Do'konim", bozor: 'Bozor',
    },
    dashboard: {
      title: 'Dashboard', subtitle: "Xush kelibsiz! Bu sizning do'koningiz analitikasi.",
      badge: "Sizning ma'lumotingiz", sync: 'Sinxronlash',
      all: 'Hammasi', revenue: 'Umumiy daromad', profit: 'Sof foyda',
      orders: 'Buyurtmalar', stock: 'Ombordagi mahsulot',
      recentOrders: "So'nggi buyurtmalar", topProducts: 'Top mahsulotlar',
      viewAll: "Hammasini ko'rish", noData: "Hali ma'lumot yo'q",
      noDataDesc: "Do'koningizni ulash uchun Sozlamalar sahifasiga o'ting, Uzum API tokeningizni kiriting va sinxronizatsiyani boshlang.",
      goSettings: "Sozlamalarga o'tish",
      dailyRevenue: 'Kunlik daromad', categories: 'Kategoriyalar',
      product: 'Mahsulot', profit2: 'Foyda', sold: 'Sotilgan',
      syncing: 'Sinxronlanmoqda...', done: 'Tayyor!', err: 'Xato',
      last: "So'nggi", daysSuffix: 'kun',
    },
    status: {
      pending: 'Kutilmoqda', confirmed: 'Tasdiqlandi', delivered: 'Yetkazildi',
      cancelled: 'Bekor', returned: 'Qaytarildi',
    },
  },
  en: {
    nav: {
      dashboard: 'Dashboard', products: 'Products', orders: 'Orders',
      analytics: 'Analytics', pnl: 'P&L Report', calculator: 'Calculator',
      market: 'Market Research', settings: 'Settings', profile: 'Profile', logout: 'Sign out',
      store: 'My Store', bozor: 'Market',
    },
    dashboard: {
      title: 'Dashboard', subtitle: 'Welcome! This is your store analytics.',
      badge: 'Your data', sync: 'Sync',
      all: 'All', revenue: 'Total revenue', profit: 'Net profit',
      orders: 'Orders', stock: 'Stock',
      recentOrders: 'Recent orders', topProducts: 'Top products',
      viewAll: 'View all', noData: 'No data yet',
      noDataDesc: 'Go to Settings, enter your Uzum API token and start syncing.',
      goSettings: 'Go to settings',
      dailyRevenue: 'Daily revenue', categories: 'Categories',
      product: 'Product', profit2: 'Profit', sold: 'Sold',
      syncing: 'Syncing...', done: 'Done!', err: 'Error',
      last: 'Last', daysSuffix: 'days',
    },
    status: {
      pending: 'Pending', confirmed: 'Confirmed', delivered: 'Delivered',
      cancelled: 'Cancelled', returned: 'Returned',
    },
  },
  ru: {
    nav: {
      dashboard: 'Дашборд', products: 'Товары', orders: 'Заказы',
      analytics: 'Аналитика', pnl: 'Отчёт P&L', calculator: 'Калькулятор',
      market: 'Исследование рынка', settings: 'Настройки', profile: 'Профиль', logout: 'Выйти',
      store: 'Мой магазин', bozor: 'Рынок',
    },
    dashboard: {
      title: 'Дашборд', subtitle: 'Добро пожаловать! Это аналитика вашего магазина.',
      badge: 'Ваши данные', sync: 'Синхронизировать',
      all: 'Все', revenue: 'Общая выручка', profit: 'Чистая прибыль',
      orders: 'Заказы', stock: 'Остатки',
      recentOrders: 'Последние заказы', topProducts: 'Топ товаров',
      viewAll: 'Смотреть все', noData: 'Данных пока нет',
      noDataDesc: 'Перейдите в Настройки, введите API-токен Uzum и запустите синхронизацию.',
      goSettings: 'Перейти в настройки',
      dailyRevenue: 'Дневная выручка', categories: 'Категории',
      product: 'Товар', profit2: 'Прибыль', sold: 'Продано',
      syncing: 'Синхронизирую...', done: 'Готово!', err: 'Ошибка',
      last: 'Последние', daysSuffix: 'дн.',
    },
    status: {
      pending: 'Ожидает', confirmed: 'Подтверждён', delivered: 'Доставлен',
      cancelled: 'Отменён', returned: 'Возвращён',
    },
  },
} satisfies Record<Lang, unknown>
