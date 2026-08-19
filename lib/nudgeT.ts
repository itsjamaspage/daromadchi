/**
 * Copy for the in-app nudge banner.
 *
 * Same shape as lockT/tiersT: one table, three languages side by side, so a
 * missing translation shows up in the diff. The Telegram wording lives with the
 * sweep in lib/billing/nudge.ts because it is HTML for a different medium; both
 * say the same thing.
 */
import type { Lang } from './i18n'

type Tr = Record<Lang, string>
function tr(ru: string, uz: string, en: string): Tr {
  return { ru, uz, en }
}

export const nudgeT = {
  trialEndingTitle: tr('Пробный период заканчивается', 'Sinov muddati tugayapti', 'Your trial is ending'),
  trialEndingBody:  tr(
    'После этого аналитика, склад, финансы и юнит-экономика закроются. Дашборд, товары, заказы и оба маркетплейса останутся бесплатными навсегда.',
    "Shundan keyin tahlil, ombor, moliya va unit-iqtisod yopiladi. Boshqaruv paneli, mahsulotlar, buyurtmalar va ikkala marketpleys doimo bepul qoladi.",
    'After that analytics, stock sync, finances and unit economics lock. Dashboard, products, orders and both marketplaces stay free for good.',
  ),
  daysLeft:         tr('Осталось дней:', 'Qolgan kunlar:', 'Days left:'),

  trialEndedTitle:  tr('Пробный период закончился', 'Sinov muddati tugadi', 'Your trial has ended'),
  trialEndedBody:   tr(
    'Аналитика, склад, финансы и юнит-экономика закрыты. Чтобы вернуть доступ, выберите тариф — он подбирается по вашему обороту.',
    "Tahlil, ombor, moliya va unit-iqtisod yopildi. Kirishni tiklash uchun tarifni tanlang — u aylanmangizga qarab belgilanadi.",
    'Analytics, stock sync, finances and unit economics are locked. To restore access, choose a plan — your tier follows your turnover.',
  ),

  outgrewTitle:     tr('Ваш оборот вырос', "Aylanmangiz o'sdi", 'Your turnover has grown'),
  outgrewBody:      tr(
    'Ничего не списывается автоматически — тариф вы подключаете сами, когда решите.',
    "Hech narsa avtomatik yechilmaydi — tarifni o'zingiz xohlaganingizda ulaysiz.",
    'Nothing is charged automatically — you subscribe when you decide to.',
  ),
  over30Days:       tr('За последние 30 дней:', "So'nggi 30 kunda:", 'Over the last 30 days:'),
  suggestedTier:    tr('По нашей шкале это тариф', "Bizning shkalamiz bo'yicha bu", 'On our ladder that is'),

  choosePlan:       tr('Выбрать тариф', 'Tarifni tanlash', 'Choose a plan'),
  dismiss:          tr('Понятно', 'Tushunarli', 'Got it'),
} satisfies Record<string, Tr>
