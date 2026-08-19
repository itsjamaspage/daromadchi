// Marketing feature bullets for the current-plan card on the dashboard billing
// page.
//
// NONE of this affects what ATMOS charges — the charged price comes from
// PLAN_PRICES_TIYIN (lib/billing/plans.ts).
//
// The struck-through "was" anchors (350 000 / 650 000) and their discount
// badges were removed with the turnover ladder: they framed 250 000 / 500 000 as
// a saving against a price that was never charged, and once the real prices
// became 150 000 / 250 000 the framing described nothing at all. The yearly
// discount badge is now derived from the two real prices — see
// annualDiscountPct() in ./plans.ts.

export type PlanTier = 'free' | 'pro' | 'pro_plus'
type Lang = 'uz' | 'en' | 'ru'

// Feature bullets per tier — the plan offerings themselves are unchanged; these
// are the same offerings named as they appear on the pricing cards, laddered so
// each higher tier is a strict superset of the one below (Free ⊂ Pro ⊂ Pro+).
// No store-count bullets — plan store limits live in PLAN_SHOP_LIMITS, not here.
// Same list is used on both the landing section and the dashboard modal so they
// can't drift.
const FEATURES: Record<Lang, Record<PlanTier, string[]>> = {
  ru: {
    free: ['Умный дашборд', 'Аналитика товаров', 'Финансы и ДДС'],
    pro: ['Умный дашборд', 'Аналитика товаров', 'Финансы и ДДС', 'Unit-экономика'],
    pro_plus: ['Умный дашборд', 'Аналитика товаров', 'Финансы и ДДС', 'Unit-экономика', 'Фактическая Unit-экономика'],
  },
  uz: {
    free: ['Aqlli boshqaruv paneli', 'Mahsulot tahlili', 'Moliya va pul oqimi (DDS)'],
    pro: ['Aqlli boshqaruv paneli', 'Mahsulot tahlili', 'Moliya va pul oqimi (DDS)', 'Unit-iqtisod'],
    pro_plus: ['Aqlli boshqaruv paneli', 'Mahsulot tahlili', 'Moliya va pul oqimi (DDS)', 'Unit-iqtisod', 'Faktik Unit-iqtisod'],
  },
  en: {
    free: ['Smart dashboard', 'Product analytics', 'Finance & cash flow'],
    pro: ['Smart dashboard', 'Product analytics', 'Finance & cash flow', 'Unit economics'],
    pro_plus: ['Smart dashboard', 'Product analytics', 'Finance & cash flow', 'Unit economics', 'Actual unit economics'],
  },
}

export function planFeatureList(lang: string): Record<PlanTier, string[]> {
  return FEATURES[(lang in FEATURES ? lang : 'uz') as Lang]
}

// popularLabel() went with the "Ommabop" badge on the plan cards: under the
// turnover ladder a tier is assigned, so calling one of them popular would
// suggest a choice the seller does not make.

// so'm formatting to match the rest of billing (thousands-spaced).
export function fmtSom(n: number): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}
