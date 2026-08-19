'use client'

/**
 * The turnover ladder — the one element that has to teach the pricing model.
 *
 * Turnover is the LEFT column because turnover is what decides the tier; the
 * plan name is the consequence, not the choice. Read top to bottom it is a
 * scale of business size, so a seller finds themselves on it rather than
 * comparing five things.
 *
 * Rows rather than cards: five cards need ~1200px and scroll sideways on a
 * phone, and a card with its own CTA says "choose me" — which is the wrong
 * mental model when turnover assigns the tier.
 *
 * Every price is visible before any input. The turnover field HIGHLIGHTS a row;
 * it never gates the numbers. A pricing page that withholds prices until you
 * interact loses the people who came to see prices.
 */

import { useMemo, useState } from 'react'
import { assignTier, TURNOVER_BANDS, type Tier } from '@/lib/billing/tiers'
import { tierPriceTiyin, tierCheckoutHref, isSelfServe } from '@/lib/billing/tier-pricing'
import { formatSomFromTiyin, type Interval } from '@/lib/billing/plans'
import { tiersT } from '@/lib/tiersT'
import type { Lang } from '@/lib/i18n'

/** Low → high, the order a seller grows through. */
const LADDER: Tier[] = ['free', 'pro', 'pro_plus', 'biznes', 'enterprise']

const TIER_LABEL: Record<Tier, keyof typeof tiersT> = {
  free: 'free', pro: 'pro', pro_plus: 'proPlus', biznes: 'biznes', enterprise: 'enterprise',
}

function bandMin(tier: Tier): number {
  return TURNOVER_BANDS.find(b => b.tier === tier)?.min ?? 0
}

/** The exclusive upper edge of a band: the next tier's floor, or none at the top. */
function bandMax(tier: Tier): number | null {
  const i = LADDER.indexOf(tier)
  return i < LADDER.length - 1 ? bandMin(LADDER[i + 1]) : null
}

const toMln = (som: number) => Math.round(som / 1_000_000)

function rangeLabel(tier: Tier, lang: Lang): string {
  const t = (k: keyof typeof tiersT) => tiersT[k][lang]
  const min = bandMin(tier)
  const max = bandMax(tier)
  const mln = t('mln')
  if (max === null) return `${toMln(min)} ${mln}+`
  if (min === 0) return `0 – ${toMln(max)} ${mln}`
  return `${toMln(min)} – ${toMln(max)} ${mln}`
}

/** Digits only, so a pasted "65 000 000" or "65,000,000" both work. */
function parseSom(raw: string): number | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

const groupSom = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

interface Props {
  lang: Lang
  interval: Interval
  /** Highlight this tier without any input — the dashboard already knows it. */
  highlight?: Tier | null
  /** Hide the turnover field where the tier is already known. */
  showInput?: boolean
  /** Drop prices and CTAs to a single line, for the landing teaser. */
  compact?: boolean
  /**
   * Make every self-serve row selectable. A seller with no measured sales still
   * has to be able to pick something — turnover only decides which tier we
   * RECOMMEND, and a brand-new account has no turnover to recommend from.
   */
  onSelect?: (tier: Tier) => void
  /** Label the highlighted row as our recommendation rather than a fact. */
  markRecommended?: boolean
  /** The tier the seller is already on, so its row says so instead of offering a buy. */
  currentTier?: Tier | null
}

export default function TierLadder({
  lang, interval, highlight = null, showInput = true, compact = false,
  onSelect, markRecommended = false, currentTier = null,
}: Props) {
  const t = (k: keyof typeof tiersT) => tiersT[k][lang]
  const [entered, setEntered] = useState('')

  const typedTurnover = useMemo(() => parseSom(entered), [entered])
  const matched: Tier | null = typedTurnover !== null ? assignTier(typedTurnover) : highlight

  return (
    <div className="space-y-4">
      {showInput && (
        <div className="rounded-2xl border p-4 sm:p-5"
          style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
          <label htmlFor="turnover" className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-base)' }}>
            {t('askTurnover')}
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                id="turnover"
                inputMode="numeric"
                autoComplete="off"
                value={typedTurnover === null ? '' : groupSom(typedTurnover)}
                onChange={e => setEntered(e.target.value)}
                placeholder="65 000 000"
                aria-describedby="turnover-hint"
                className="w-full rounded-xl border px-4 py-3 pr-16 text-lg font-semibold tabular-nums outline-none focus-visible:ring-2"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-base)' }}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm"
                style={{ color: 'var(--text-muted)' }}>
                {t('som')}
              </span>
            </div>
            {typedTurnover !== null && (
              <button type="button" onClick={() => setEntered('')}
                className="rounded-xl border px-3 py-3 text-xs font-semibold"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                {t('clear')}
              </button>
            )}
          </div>
          <p id="turnover-hint" className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {typedTurnover !== null && matched
              ? `${t('yourTier')}: ${t(TIER_LABEL[matched])}`
              : t('inputHint')}
          </p>
        </div>
      )}

      <ol className="overflow-hidden rounded-2xl border"
        style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
        {!compact && (
          <li className="grid grid-cols-[1fr_auto] gap-3 border-b px-4 py-2 sm:grid-cols-[1.2fr_1fr_1fr]"
            style={{ borderColor: 'var(--border)' }}>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{t('colTurnover')}</span>
            <span className="hidden text-[10px] font-bold uppercase tracking-widest sm:block" style={{ color: 'var(--text-muted)' }}>{t('colTier')}</span>
            <span className="text-right text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{t('colPrice')}</span>
          </li>
        )}

        {LADDER.map(tier => {
          const priceTiyin = tierPriceTiyin(tier, interval)
          const href = tierCheckoutHref(tier, interval)
          const isMatch = matched === tier
          return (
            <li key={tier}
              aria-current={isMatch ? 'true' : undefined}
              className="grid grid-cols-[1fr_auto] items-center gap-3 border-b px-4 py-4 last:border-b-0 transition-colors sm:grid-cols-[1.2fr_1fr_1fr]"
              style={{
                borderColor: 'var(--border)',
                background: isMatch ? 'rgba(47,109,246,0.09)' : undefined,
                boxShadow: isMatch ? 'inset 3px 0 0 var(--c1)' : undefined,
              }}>
              {/* Turnover first: it is what decides the tier. */}
              <span className="text-sm font-semibold tabular-nums" style={{ color: isMatch ? 'var(--c1)' : 'var(--text-base)' }}>
                {rangeLabel(tier, lang)}
              </span>

              <span className="hidden items-center gap-2 sm:flex">
                <span className="text-sm font-bold" style={{ color: 'var(--text-base)' }}>{t(TIER_LABEL[tier])}</span>
                {markRecommended && isMatch && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                    style={{ background: 'var(--c1)', color: '#fff' }}>
                    {t('recommended')}
                  </span>
                )}
                {tier === 'free' && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'rgba(47,109,246,0.12)', color: 'var(--c1)' }}>
                    {t('trialBadge')}
                  </span>
                )}
              </span>

              <span className="text-right">
                {/* Mobile has no tier column, so the name rides above the price. */}
                <span className="mb-0.5 block text-xs font-bold sm:hidden" style={{ color: 'var(--text-base)' }}>
                  {t(TIER_LABEL[tier])}
                </span>
                {priceTiyin === null ? (
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{t('contact')}</span>
                ) : priceTiyin === 0 ? (
                  <span className="text-sm font-bold" style={{ color: 'var(--text-base)' }}>{t('freePrice')}</span>
                ) : (
                  <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-base)' }}>
                    {formatSomFromTiyin(priceTiyin)}{' '}
                    <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{t('perMonth')}</span>
                  </span>
                )}
                {/* Two audiences, two behaviours — both sides of the merge were
                    right about their own case.

                    In-app (onSelect given): EVERY self-serve row is buyable. A
                    seller with no measured sales still has to be able to pick a
                    plan, and turnover only decides which one we recommend.

                    Public page (no onSelect): only the MATCHED row offers an
                    action, and when a tier has no checkout route — Biznes,
                    Enterprise — it points at contact rather than a link that
                    would fail. */}
                {!compact && onSelect ? (
                  tier === currentTier ? (
                    <span className="mt-1 block text-xs font-semibold" style={{ color: 'var(--c1)' }}>
                      {t('currentPlan')}
                    </span>
                  ) : isSelfServe(tier) ? (
                    <button type="button" onClick={() => onSelect(tier)}
                      className="mt-1 text-xs font-semibold underline underline-offset-2"
                      style={{ color: 'var(--c1)' }}>
                      {t('choose')}
                    </button>
                  ) : tier === 'free' ? null : (
                    <a href="https://t.me/daromadchi_uz" target="_blank" rel="noopener noreferrer"
                      className="mt-1 block text-xs font-semibold underline underline-offset-2" style={{ color: 'var(--c1)' }}>
                      {t('talkToUs')}
                    </a>
                  )
                ) : !compact && isMatch ? (href ? (
                  <a href={href} className="mt-1 block text-xs font-semibold underline underline-offset-2" style={{ color: 'var(--c1)' }}>
                    {isSelfServe(tier) ? t('choose') : t('start')}
                  </a>
                ) : (
                  <a href="https://t.me/daromadchi_uz" target="_blank" rel="noopener noreferrer"
                    className="mt-1 block text-xs font-semibold underline underline-offset-2" style={{ color: 'var(--c1)' }}>
                    {t('talkToUs')}
                  </a>
                )) : null}
              </span>
            </li>
          )
        })}
      </ol>

      {interval === 'annual' && !compact && (
        <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>{t('billedYearly')}</p>
      )}
    </div>
  )
}
