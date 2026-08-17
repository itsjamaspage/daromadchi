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

// Feature bullets per tier — the plan offerings themselves are unchanged; these
// are the same offerings named as they appear on the pricing cards, laddered so
// each higher tier is a strict superset of the one below (Free ⊂ Pro ⊂ Pro+).
// No store-count bullets — plan store limits live in PLAN_SHOP_LIMITS, not here.
// Same list is used on both the landing section and the dashboard modal so they
// can't drift.
const FEATURES: Record<Lang, Record<PlanTier, string[]>> = {
  ru: {
    free: ['Умный дашборд', 'Аналитика товаров и рекламы', 'Финансы и ДДС'],
    pro: ['Умный дашборд', 'Аналитика товаров и рекламы', 'Финансы и ДДС', 'Unit-экономика'],
    pro_plus: ['Умный дашборд', 'Аналитика товаров и рекламы', 'Финансы и ДДС', 'Unit-экономика', 'Фактическая Unit-экономика'],
  },
  uz: {
    free: ['Aqlli boshqaruv paneli', 'Mahsulot va reklama tahlili', 'Moliya va pul oqimi (DDS)'],
    pro: ['Aqlli boshqaruv paneli', 'Mahsulot va reklama tahlili', 'Moliya va pul oqimi (DDS)', 'Unit-iqtisod'],
    pro_plus: ['Aqlli boshqaruv paneli', 'Mahsulot va reklama tahlili', 'Moliya va pul oqimi (DDS)', 'Unit-iqtisod', 'Faktik Unit-iqtisod'],
  },
  en: {
    free: ['Smart dashboard', 'Product & ad analytics', 'Finance & cash flow'],
    pro: ['Smart dashboard', 'Product & ad analytics', 'Finance & cash flow', 'Unit economics'],
    pro_plus: ['Smart dashboard', 'Product & ad analytics', 'Finance & cash flow', 'Unit economics', 'Actual unit economics'],
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
