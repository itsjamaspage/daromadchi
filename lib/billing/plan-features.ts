// SINGLE source of truth for the marketing feature bullets + display-only price
// anchors shown on BOTH the landing pricing section (app/HomeClient.tsx) and the
// dashboard "Сменить тариф" modal (app/dashboard/billing/BillingClient.tsx), so
// the two can never drift apart again.
//
// NONE of this affects what ATMOS charges — the real charged price comes from
// PLAN_PRICES_TIYIN (lib/billing/plans.ts). The anchor ("was") prices below are
// purely visual discount framing.

export type PlanTier = 'free' | 'pro' | 'pro_plus'
type Lang = 'uz' | 'en' | 'ru'

// Display-only "was" prices in so'm, struck through above the real price to convey
// a discount. NEVER charged. Real prices stay 250 000 / 500 000 (PLAN_PRICES_TIYIN).
export const PLAN_ANCHOR_SOM: Record<'pro' | 'pro_plus', number> = {
  pro: 350_000,
  pro_plus: 650_000,
}

// Rounded discount vs the anchor: (350-250)/350 ≈ 29 %, (650-500)/650 ≈ 23 %.
export const PLAN_DISCOUNT_PCT: Record<'pro' | 'pro_plus', number> = {
  pro: 29,
  pro_plus: 23,
}

export const POPULAR_LABEL: Record<Lang, string> = {
  ru: 'Популярный',
  uz: 'Ommabop',
  en: 'Popular',
}

// Feature bullets per tier. Store counts (1 / 3 / 5) match PLAN_SHOP_LIMITS;
// free history matches the enforced 7-day cap.
const FEATURES: Record<Lang, Record<PlanTier, string[]>> = {
  ru: {
    free: ['1 магазин', '7 дней истории', 'Базовая аналитика'],
    pro: [
      'До 3 магазинов',
      'Вся аналитика (юнит-экономика, реклама, P&L)',
      'Uzum + Yandex Market',
      'Автосинхронизация',
      'Email и Telegram уведомления',
      'Chrome-расширение',
    ],
    pro_plus: ['До 5 магазинов', 'Всё из Pro', 'API-доступ', 'Приоритетная поддержка'],
  },
  uz: {
    free: ["1 do'kon", '7 kunlik tarix', 'Asosiy tahlil'],
    pro: [
      "3 ta do'kongacha",
      'Barcha tahlillar (yunit-iqtisod, reklama, P&L)',
      'Uzum + Yandex Market',
      'Avto-sinxronizatsiya',
      'Email va Telegram bildirishnomalar',
      'Chrome kengaytma',
    ],
    pro_plus: ["5 ta do'kongacha", 'Barcha Pro imkoniyatlari', 'API kirish', 'Ustuvor yordam'],
  },
  en: {
    free: ['1 store', '7 days of history', 'Basic analytics'],
    pro: [
      'Up to 3 stores',
      'Full analytics (unit economics, ads, P&L)',
      'Uzum + Yandex Market',
      'Auto-sync',
      'Email & Telegram notifications',
      'Chrome extension',
    ],
    pro_plus: ['Up to 5 stores', 'Everything in Pro', 'API access', 'Priority support'],
  },
}

export function planFeatureList(lang: string): Record<PlanTier, string[]> {
  return FEATURES[(lang in FEATURES ? lang : 'uz') as Lang]
}

export function popularLabel(lang: string): string {
  return POPULAR_LABEL[(lang in POPULAR_LABEL ? lang : 'uz') as Lang]
}

// so'm formatting to match the rest of billing (thousands-spaced).
export function fmtSom(n: number): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}
