'use client'

import { TrendingUp, AlertTriangle } from 'lucide-react'
import { bandRange, nextTierUp, nearCeilingThreshold, type Tier } from '@/lib/billing/tiers'
import { tiersT, nearCeilingSentence } from '@/lib/tiersT'
import type { Lang } from '@/lib/i18n'

const TIER_LABEL: Record<Tier, keyof typeof tiersT> = {
  free: 'free', pro: 'pro', pro_plus: 'proPlus', biznes: 'biznes', enterprise: 'enterprise',
}

const som = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
const toMln = (n: number) => Math.round(n / 1_000_000)

interface Props {
  lang: Lang
  /** The tier the ladder puts them on — users.derived_tier. */
  tier: Tier | null
  /** Their measured 30-day turnover in so'm — users.derived_turnover_som. */
  turnoverSom: number | null
}

/**
 * Where the seller sits on the turnover ladder, on the billing page.
 *
 * DISPLAY ONLY. It reads the recommendation the daily job already computed
 * (derived_tier / derived_turnover_som, both from computeTurnover30d) and
 * changes nothing: not the plan, not entitlement, not a charge. The same
 * recommendation the nudge and the outreach popup act on, shown where a seller
 * would go looking for it.
 *
 * The warning fires at nearCeilingThreshold(), which is the SAME 90 %-of-ceiling
 * rule the Enterprise outreach popup uses — one function, so the page and the
 * popup cannot disagree about when someone is close.
 */
export default function TurnoverPanel({ lang, tier, turnoverSom }: Props) {
  const t = (k: keyof typeof tiersT) => tiersT[k][lang]

  // Nothing measured yet: say so rather than drawing a zero, which reads as
  // "you sold nothing" to a seller who simply has not synced.
  if (tier === null || turnoverSom === null || !Number.isFinite(turnoverSom)) {
    return (
      <Shell lang={lang}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('notComputed')}</p>
      </Shell>
    )
  }

  const { min, max } = bandRange(tier)
  const next = nextTierUp(tier)
  const threshold = nearCeilingThreshold(tier)
  const near = threshold !== null && turnoverSom >= threshold

  // Top of the ladder: there is no ceiling to fill, so a progress bar would be
  // drawing a fraction of infinity.
  if (max === null) {
    return (
      <Shell lang={lang}>
        <Amount lang={lang} value={turnoverSom} tier={tier} />
        <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{t('noCeiling')}</p>
      </Shell>
    )
  }

  // Fraction OF THE CEILING, not position within the band.
  //
  // The two disagree, and it matters: a Biznes seller at 165 mln is 75 % of the
  // way through the 120–180 band but 92 % of the way to its ceiling — and the
  // warning fires at 90 % of the ceiling. Drawing band-position would show a
  // three-quarters bar turning red, which reads as a bug. This is also the
  // number the label claims ("of the ceiling") and the one the outreach popup
  // measures, so bar, label and warning are all the same fraction.
  const pct = max > 0 ? Math.min(100, Math.max(0, (turnoverSom / max) * 100)) : 0
  const accent = near ? '#dc2626' : 'var(--c1)'

  return (
    <Shell lang={lang}>
      <Amount lang={lang} value={turnoverSom} tier={tier} />

      <div className="mt-4">
        {/* Stacked on a phone: side by side, the range label breaks mid-number
            ("12–" / "50 mln"), which is worse than two clean lines. */}
        <div className="mb-1.5 flex flex-col gap-0.5 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-2"
          style={{ color: 'var(--text-muted)' }}>
          <span>{t('bandLabel')}: {t(TIER_LABEL[tier])} · {toMln(min)}–{toMln(max)} {t('mln')}</span>
          <span className="tabular-nums whitespace-nowrap">{Math.round(pct)}% {t('ofCeiling')}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--bg-card)' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: accent }} />
        </div>
      </div>

      {near && next && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl p-3"
          style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)' }}>
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: '#dc2626' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-base)' }}>
            <span className="font-semibold">{t('nearCeiling')}.</span>{' '}
            {nearCeilingSentence(lang, som(max), t(TIER_LABEL[next]))}
          </p>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {t('turnoverIsNotProfit')}
      </p>
    </Shell>
  )
}

function Shell({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)' }}>
      <div className="flex items-center gap-2 border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
        <TrendingUp className="h-4 w-4" style={{ color: 'var(--c1)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>
          {tiersT.turnoverPanelTitle[lang]}
        </h2>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  )
}

function Amount({ lang, value, tier }: { lang: Lang; value: number; tier: Tier }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-base)' }}>
        {som(value)} <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>{tiersT.som[lang]}</span>
      </p>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {tiersT.yourTurnover[lang].toLowerCase()} · {tiersT[TIER_LABEL[tier]][lang]}
      </span>
    </div>
  )
}
