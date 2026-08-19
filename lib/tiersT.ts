// Labels for the turnover ladder, shared by /pricing, the landing Tariflar
// section and the dashboard billing modal, so the three cannot describe the
// same model in three different vocabularies.
import type { Lang } from './i18n'
import { type Feature } from './billing/features'
import { TRIAL_D as D, TRIAL_RU as RU_D, TRIAL_EN as EN_D } from './trial-copy'

type Tr = Record<Lang, string>
function tr(ru: string, uz: string, en: string): Tr {
  return { ru, uz, en }
}

export const tiersT = {
  // ── how the model works ──
  eyebrow:      tr('Тарифы', 'Tariflar', 'Pricing'),
  title:        tr('Тариф по вашему обороту', 'Aylanmangizga qarab tarif', 'Priced on your turnover'),
  subtitle:     tr(
    'Тариф определяется вашим оборотом за 30 дней — выбирать не нужно.',
    "Tarif 30 kunlik aylanmangiz bo'yicha aniqlanadi — tanlash shart emas.",
    'Your tier follows your 30-day turnover — there is nothing to choose.',
  ),

  // ── the turnover input ──
  askTurnover:  tr('Сколько вы продаёте в месяц?', 'Oyiga qancha sotasiz?', 'How much do you sell per month?'),
  inputHint:    tr('Введите оборот, чтобы увидеть свой тариф', "Aylanmangizni kiriting va tarifingizni ko'ring", 'Enter your turnover to see your tier'),
  yourTier:     tr('Ваш тариф', 'Sizning tarifingiz', 'Your tier'),
  clear:        tr('Сбросить', 'Tozalash', 'Clear'),

  // ── ladder columns ──
  colTurnover:  tr('Оборот в месяц', 'Oylik aylanma', 'Monthly turnover'),
  colTier:      tr('Тариф', 'Tarif', 'Tier'),
  colPrice:     tr('Цена', 'Narx', 'Price'),

  // ── tier names ──
  free:         tr('Бесплатно', 'Bepul', 'Free'),
  pro:          tr('Pro', 'Pro', 'Pro'),
  proPlus:      tr('Pro+', 'Pro+', 'Pro+'),
  biznes:       tr('Бизнес', 'Biznes', 'Biznes'),
  enterprise:   tr('Enterprise', 'Enterprise', 'Enterprise'),

  // ── prices ──
  perMonth:     tr('сум/мес', "so'm/oy", "so'm/mo"),
  freePrice:    tr('0 сум', "0 so'm", "0 so'm"),
  contact:      tr('По запросу', "Bog'laning", 'Contact us'),
  billedYearly: tr('при оплате за год', "yillik to'lovda", 'billed yearly'),
  monthly:      tr('Помесячно', 'Oylik', 'Monthly'),
  yearly:       tr('За год', 'Yillik', 'Yearly'),

  // ── turnover range formatting ──
  upTo:         tr('до', 'gacha', 'up to'),
  from:         tr('от', 'dan', 'from'),
  mln:          tr('млн', 'mln', 'M'),
  som:          tr('сум', "so'm", "so'm"),

  // ── actions ──
  start:        tr('Начать бесплатно', 'Bepul boshlash', 'Start free'),
  choose:       tr('Подключить', 'Ulash', 'Get started'),
  talkToUs:     tr('Связаться', "Bog'lanish", 'Talk to us'),
  seeAll:       tr('Все тарифы', 'Barcha tariflar', 'See all tiers'),
  prevTier:     tr('Предыдущий тариф', 'Oldingi tarif', 'Previous tier'),
  nextTier:     tr('Следующий тариф', 'Keyingi tarif', 'Next tier'),

  // ── trial ──
  trialBadge:   tr(`${RU_D} бесплатно`, `${D} kun bepul`, `${EN_D} free`),
  trialNote:    tr(
    `Первые ${RU_D} после регистрации все функции открыты.`,
    `Ro'yxatdan o'tgandan keyingi ${D} kun davomida barcha imkoniyatlar ochiq.`,
    `Everything is unlocked for your first ${EN_D}.`,
  ),

  // ── billing modal ──
  yourTurnover: tr('Ваш оборот за 30 дней', '30 kunlik aylanmangiz', 'Your 30-day turnover'),
  recommended:  tr('Рекомендуем', 'Tavsiya etamiz', 'Recommended'),
  // Shown to a brand-new seller who has no measured sales yet. They still pick a
  // plan; the measurement only moves them later.
  noSalesYet:   tr(
    'Продаж пока нет — выберите тариф, а мы подберём точный по мере роста.',
    "Hozircha sotuv yo'q — tarifni tanlang, o'sishingizga qarab aniqlashtiramiz.",
    'No sales measured yet — pick a plan and we will match it to your growth.',
  ),
  autoAdjust:   tr(
    'Мы считаем ваш оборот за 30 дней. Если он выйдет за рамки тарифа, мы предупредим вас заранее и предложим подходящий — без автоматического списания новой суммы.',
    "30 kunlik aylanmangizni hisoblab boramiz. Agar u tarif chegarasidan chiqsa, oldindan xabar beramiz va mos tarifni taklif qilamiz — yangi summa avtomatik yechilmaydi.",
    'We measure your 30-day turnover. If it outgrows your plan we tell you first and suggest the right one — no new amount is charged automatically.',
  ),
  computedNote: tr(
    'Тариф рассчитан по вашему обороту — менять вручную не нужно.',
    "Tarif aylanmangiz bo'yicha hisoblangan — qo'lda o'zgartirish shart emas.",
    'Your tier is computed from your turnover — there is nothing to pick.',
  ),
  notComputed:  tr(
    'Оборот ещё не рассчитан. Подключите магазин и синхронизируйте продажи.',
    "Aylanma hali hisoblanmagan. Do'koningizni ulang va sotuvlarni sinxronlang.",
    'No turnover yet. Connect a store and sync your sales.',
  ),
  payWith:      tr('Оплатить картой', "Karta bilan to'lash", 'Pay by card'),
  requestInvoice: tr('Выставить счёт', "Hisob-faktura so'rash", 'Request an invoice'),
  currentPlan:  tr('Текущий тариф', 'Joriy tarif', 'Current plan'),

  // ── turnover panel on the billing page ──
  // "Turnover", never "revenue" or "доход": this is the value of orders that
  // decides the tier, not money the seller keeps. Calling it income on a BILLING
  // page — next to real amounts they are charged — would be the single most
  // misleading word in the product.
  turnoverPanelTitle: tr('Ваш оборот', 'Aylanmangiz', 'Your turnover'),
  turnoverIsNotProfit: tr(
    'Это стоимость заказов за 30 дней без отменённых и возвратов — не прибыль и не выплаты. По ней определяется тариф.',
    "Bu 30 kunlik buyurtmalar qiymati (bekor qilingan va qaytarilganlarsiz) — foyda yoki to'lov emas. Tarif shunga qarab belgilanadi.",
    'This is the value of your orders over 30 days, excluding cancelled and returned — not profit, not payouts. It is what sets your tier.',
  ),
  bandLabel:    tr('Диапазон тарифа', 'Tarif oralig\u2018i', 'Tier range'),
  ofCeiling:    tr('от верхней границы', 'yuqori chegaradan', 'of the ceiling'),
  nearCeiling:  tr('Вы близко к верхней границе тарифа', 'Tarifning yuqori chegarasiga yaqinsiz', 'You are close to outgrowing this tier'),
  noCeiling:    tr(
    'Это верхний тариф — фиксированной границы нет. На таких объёмах условия обсуждаются индивидуально.',
    "Bu eng yuqori tarif — belgilangan chegara yo'q. Bunday hajmlarda shartlar alohida kelishiladi.",
    'This is the top tier — there is no fixed ceiling. At this volume terms are agreed individually.',
  ),

  // ── feature matrix ──
  featuresTitle: tr('Что входит', 'Nimalar kiradi', "What's included"),
  trial:         tr(`${D} дн.`, `${D} kun`, EN_D),
} satisfies Record<string, Tr>

/**
 * "At 50 000 000 so'm you move to Pro+."
 *
 * Built per language rather than by concatenating label fragments: Uzbek puts
 * the verb last and Russian does not, so the fragment approach produced word
 * salad in one of the three every time.
 */
export function nearCeilingSentence(lang: Lang, amountSom: string, nextTier: string): string {
  if (lang === 'ru') return `При обороте ${amountSom} сум вы переходите на ${nextTier}.`
  if (lang === 'en') return `At ${amountSom} so'm you move to ${nextTier}.`
  return `Aylanma ${amountSom} so'mga yetganda ${nextTier} tarifiga o'tasiz.`
}

/**
 * Capability names for the per-tier "what's included" list.
 *
 * Keyed by the Feature union in lib/billing/features.ts rather than by array
 * position, so adding a capability there is a type error here until it is
 * named — the /pricing table's parallel arrays could silently slip out of
 * alignment, this cannot.
 */
export const featureT: Record<Feature, Tr> = {
  dashboard:      tr('Умный дашборд', 'Aqlli boshqaruv paneli', 'Smart dashboard'),
  products:       tr('Товары', 'Mahsulotlar', 'Products'),
  orders:         tr('Заказы и уведомления', 'Buyurtmalar va ogohlantirishlar', 'Orders & alerts'),
  marketplaces:   tr('Uzum + Yandex Market', 'Uzum + Yandex Market', 'Uzum + Yandex Market'),
  analytics:      tr('Аналитика', 'Tahlil', 'Analytics'),
  stock_sync:     tr('Синхронизация склада', 'Ombor sinxronizatsiyasi', 'Stock sync'),
  finances:       tr("Финансы и выплаты", "Moliya va to'lovlar", 'Finances & payouts'),
  unit_economics: tr('Юнит-экономика', 'Unit-iqtisod', 'Unit economics'),
}
