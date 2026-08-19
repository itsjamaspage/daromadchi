/**
 * Copy for the locked-feature panel.
 *
 * Lives next to the component rather than in lib/i18n.ts for the same reason
 * lib/tiersT.ts does: one small table, all three languages side by side, so a
 * missing translation is visible in the diff instead of buried 2 000 lines into
 * a shared file. Trial wording derives from TRIAL_DAYS — never hardcode it.
 */
import type { Lang } from './i18n'
import type { Feature } from './billing/features'

type Tr = Record<Lang, string>
function tr(ru: string, uz: string, en: string): Tr {
  return { ru, uz, en }
}

/** The gateable surfaces, named as the seller sees them in the sidebar. */
export const lockedFeatureT: Partial<Record<Feature, Tr>> = {
  analytics:      tr('Аналитика', 'Tahlil', 'Analytics'),
  stock_sync:     tr('Склад', 'Ombor', 'Stock sync'),
  finances:       tr('Финансы и выплаты', "Moliya va to'lovlar", 'Finances & payouts'),
  unit_economics: tr('Юнит-экономика', 'Unit-iqtisod', 'Unit economics'),
}

export const lockT = {
  // Heading when the trial has run out — the seller HAD this and lost it, which
  // is a different message from never having had it.
  trialOver:  tr('Пробный период закончился', 'Sinov muddati tugadi', 'Your trial has ended'),
  paidOnly:   tr('Доступно на платном тарифе', 'Pullik tarifda mavjud', 'Available on a paid plan'),
  body:       tr(
    'Этот раздел входит в любой платный тариф. Тариф подбирается по вашему обороту — выберите подходящий, чтобы вернуть доступ.',
    "Bu bo'lim har qanday pullik tarifga kiradi. Tarif aylanmangizga qarab tanlanadi — kirishni tiklash uchun mosini tanlang.",
    'This section is part of every paid plan. Your tier follows your turnover — pick the one that fits to restore access.',
  ),
  cta:        tr('Выбрать тариф', 'Tarifni tanlash', 'Choose a plan'),
  seePricing: tr('Все тарифы', 'Barcha tariflar', 'See all tiers'),
  // Shown on the Stocks page specifically: gating stops the write-back, and a
  // seller must not be left thinking their marketplace stock is still syncing.
  stockNote:  tr(
    'Автоматическое обновление остатков на маркетплейсах приостановлено.',
    "Marketpleyslardagi qoldiqlarni avtomatik yangilash to'xtatilgan.",
    'Automatic stock write-back to the marketplaces is paused.',
  ),
} satisfies Record<string, Tr>
