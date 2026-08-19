// Labels for the turnover ladder, shared by /pricing, the landing Tariflar
// section and the dashboard billing modal, so the three cannot describe the
// same model in three different vocabularies.
import type { Lang } from './i18n'
import { TRIAL_DAYS } from './billing/features'

type Tr = Record<Lang, string>
function tr(ru: string, uz: string, en: string): Tr {
  return { ru, uz, en }
}

/**
 * Russian needs the right case for a day count: 1/21/31 день, 2–4 дня,
 * 5–20 дней. Interpolating TRIAL_DAYS blindly would print "21 дней", so the
 * rule lives here rather than in a hardcoded string that goes stale.
 */
function ruDays(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return 'дней'
  switch (n % 10) {
    case 1: return 'день'
    case 2: case 3: case 4: return 'дня'
    default: return 'дней'
  }
}

const D: number = TRIAL_DAYS
const RU_D = `${D} ${ruDays(D)}`
const EN_D = `${D} day${D === 1 ? '' : 's'}`

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

  // ── feature matrix ──
  featuresTitle: tr('Что входит', 'Nimalar kiradi', "What's included"),
  trial:         tr(`${D} дн.`, `${D} kun`, EN_D),
} satisfies Record<string, Tr>
