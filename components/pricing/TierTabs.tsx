'use client'

/**
 * The tier picker: a list of plans on the left, the selected plan's detail
 * panel on the right, sliding in on every change.
 *
 * Why tabs and not five side-by-side cards: all five tiers have to be on the
 * page (a seller picks one at signup, and the turnover measurement only moves
 * them later), but five cards either shrink past readability or turn into a
 * swipe strip where four fifths of the offer is off-screen. One panel at a time
 * gives every tier the same full-width room and makes the choice explicit.
 *
 * Real buttons in a real tablist, not the CSS-only radio trick from the
 * reference: the same slide animation, but arrow keys, screen readers and the
 * dashboard's onSelect callback all work, and nothing depends on :checked
 * siblings surviving a refactor.
 */

import { useMemo, useRef, useState } from 'react'
import { Check, Clock } from 'lucide-react'
import { assignTier, TURNOVER_BANDS, type Tier } from '@/lib/billing/tiers'
import { tierPriceTiyin, tierCheckoutHref, isSelfServe } from '@/lib/billing/tier-pricing'
import { formatSomFromTiyin, type Interval } from '@/lib/billing/plans'
import { FEATURE_ORDER, featureAvailability, type Plan } from '@/lib/billing/features'
import { tiersT, featureT } from '@/lib/tiersT'
import { telegramContactUrl } from '@/lib/contact'
import type { Lang } from '@/lib/i18n'

/** Low → high, the order a seller grows through. */
const LADDER: Tier[] = ['free', 'pro', 'pro_plus', 'biznes', 'enterprise']

const TIER_LABEL: Record<Tier, keyof typeof tiersT> = {
  free: 'free', pro: 'pro', pro_plus: 'proPlus', biznes: 'biznes', enterprise: 'enterprise',
}

function bandMin(tier: Tier): number {
  return TURNOVER_BANDS.find(b => b.tier === tier)?.min ?? 0
}
function bandMax(tier: Tier): number | null {
  const i = LADDER.indexOf(tier)
  return i < LADDER.length - 1 ? bandMin(LADDER[i + 1]) : null
}
const toMln = (som: number) => Math.round(som / 1_000_000)

function rangeLabel(tier: Tier, lang: Lang): string {
  const mln = tiersT.mln[lang]
  const min = bandMin(tier)
  const max = bandMax(tier)
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
  /** Preselect and badge this tier without any input — the dashboard knows it. */
  highlight?: Tier | null
  /** Show the "how much do you sell?" field above the tabs. */
  showInput?: boolean
  /** In-app: make every self-serve tier buyable instead of linking to checkout. */
  onSelect?: (tier: Tier) => void
  /** The tier the seller is already on. */
  currentTier?: Tier | null
}

export default function TierTabs({
  lang, interval, highlight = null, showInput = true, onSelect, currentTier = null,
}: Props) {
  const t = (k: keyof typeof tiersT) => tiersT[k][lang]
  const [entered, setEntered] = useState('')
  // An explicit tab click, or null while the panel is still following the
  // turnover. Typing clears it, so the "that's me" moment always wins over a
  // stale click — and because the open panel is DERIVED rather than copied into
  // state, a derived tier that arrives after mount opens itself with no effect
  // and no cascading render.
  const [picked, setPicked] = useState<Tier | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const typedTurnover = useMemo(() => parseSom(entered), [entered])
  const matched: Tier | null = typedTurnover !== null ? assignTier(typedTurnover) : highlight

  // Pro is the opening panel when nothing else is known: it is the first tier a
  // seller actually pays for, so it shows the model rather than an empty offer.
  const selected: Tier = picked ?? matched ?? currentTier ?? 'pro'

  function typeTurnover(raw: string) {
    setEntered(raw)
    setPicked(null)
  }

  function onTabKey(e: React.KeyboardEvent, i: number) {
    const last = LADDER.length - 1
    let next: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = i === last ? 0 : i + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = i === 0 ? last : i - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    if (next === null) return
    e.preventDefault()
    setPicked(LADDER[next])
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="space-y-4">
      {showInput && (
        <div className="mx-auto max-w-xl rounded-2xl border p-4 sm:p-5"
          style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
          <label htmlFor="turnover" className="mb-2 block text-sm font-semibold" style={{ color: 'var(--text-base)' }}>
            {t('askTurnover')}
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                id="turnover"
                inputMode="numeric"
                autoComplete="off"
                value={typedTurnover === null ? '' : groupSom(typedTurnover)}
                onChange={e => typeTurnover(e.target.value)}
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
              <button type="button" onClick={() => typeTurnover('')}
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

      <div className="overflow-hidden rounded-2xl border"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card2)' }}>
        <div className="flex flex-col sm:flex-row">
          {/* Tier list: a column beside the panel on desktop, a scrollable strip
              above it on a phone, where a five-row column would push the offer
              itself below the fold. */}
          <div
            role="tablist"
            aria-label={t('eyebrow')}
            className="flex shrink-0 overflow-x-auto border-b sm:w-44 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r
                       [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ borderColor: 'var(--border)' }}
          >
            {LADDER.map((tier, i) => {
              const isActive = tier === selected
              const isMatch = matched === tier
              return (
                <button
                  key={tier}
                  ref={el => { tabRefs.current[i] = el }}
                  type="button"
                  role="tab"
                  id={`tier-tab-${tier}`}
                  aria-selected={isActive}
                  aria-controls={`tier-panel-${tier}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setPicked(tier)}
                  onKeyDown={e => onTabKey(e, i)}
                  className="relative shrink-0 whitespace-nowrap px-3 py-3 text-left text-sm font-semibold transition-colors sm:px-5 sm:py-4"
                  style={{
                    color: isActive ? 'var(--c1)' : 'var(--text-muted)',
                    background: isActive ? 'var(--bg-card)' : 'transparent',
                  }}
                >
                  {t(TIER_LABEL[tier])}
                  {/* The recommended tier stays marked in the list, so it is
                      findable without opening all five panels. */}
                  {isMatch && !isActive && (
                    <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                      style={{ background: 'var(--c1)' }} aria-hidden />
                  )}
                  {/* The reference's 4px accent edge: under the tab on a phone,
                      against the panel on desktop. */}
                  {isActive && (
                    <span
                      className="absolute inset-x-0 bottom-0 h-1 sm:inset-x-auto sm:inset-y-0 sm:left-auto sm:-right-px sm:h-auto sm:w-1"
                      style={{ background: 'var(--c1)' }}
                      aria-hidden
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* One panel, replayed on every change: keying by tier restarts the
              slide, which is what makes the switch read as movement. */}
          <div
            key={selected}
            role="tabpanel"
            id={`tier-panel-${selected}`}
            aria-labelledby={`tier-tab-${selected}`}
            tabIndex={0}
            className="tier-panel-enter min-w-0 flex-1 p-5 sm:p-6"
            style={{ background: 'var(--bg-card)' }}
          >
            <TierPanel
              tier={selected}
              lang={lang}
              interval={interval}
              isMatch={matched === selected}
              isCurrent={currentTier === selected}
              onSelect={onSelect}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function TierPanel({ tier, lang, interval, isMatch, isCurrent, onSelect }: {
  tier: Tier; lang: Lang; interval: Interval
  isMatch: boolean; isCurrent: boolean
  onSelect?: (tier: Tier) => void
}) {
  const t = (k: keyof typeof tiersT) => tiersT[k][lang]
  const priceTiyin = tierPriceTiyin(tier, interval)
  const href = tierCheckoutHref(tier, interval)
  const plan = tier as Plan

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-bold" style={{ color: 'var(--text-base)' }}>{t(TIER_LABEL[tier])}</h3>
        {isMatch && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
            style={{ background: 'var(--c1)', color: 'var(--on-c1)' }}>
            {t('recommended')}
          </span>
        )}
        {isCurrent && (
          <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
            style={{ borderColor: 'var(--c1)', color: 'var(--c1)' }}>
            {t('currentPlan')}
          </span>
        )}
      </div>

      {/* Turnover stays on the panel: it is still the thing that decides which
          tier fits, even when the seller is the one choosing. */}
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {t('colTurnover')}: <span className="tabular-nums">{rangeLabel(tier, lang)}</span>
      </p>

      <div className="mt-3">
        {priceTiyin === null ? (
          <p className="text-3xl font-bold" style={{ color: 'var(--text-muted)' }}>{t('contact')}</p>
        ) : (
          <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text-base)' }}>
            {priceTiyin === 0 ? t('freePrice') : formatSomFromTiyin(priceTiyin)}
            {priceTiyin > 0 && (
              <span className="ml-1 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                {t('perMonth')}
              </span>
            )}
          </p>
        )}
        {priceTiyin !== null && priceTiyin > 0 && interval === 'annual' && (
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('billedYearly')}</p>
        )}
      </div>

      {tier === 'free' && (
        <p className="mt-3 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
          style={{ borderColor: 'var(--c1)', color: 'var(--c1)' }}>
          <Check className="h-3 w-3" /> {t('trialBadge')}
        </p>
      )}

      {/* What the tier actually gets, read off the same sets that gate it at
          runtime — a panel cannot promise something hasFeature() then refuses. */}
      <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {t('featuresTitle')}
      </p>
      {/* auto-fit rather than a sm: breakpoint: this panel is ~570px wide on
          /pricing but only ~400px inside the billing modal, and a viewport
          media query cannot tell those apart. */}
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-x-4 gap-y-1.5">
        {FEATURE_ORDER.map(f => {
          const availability = featureAvailability(plan, f)
          const trialOnly = availability === 'trial'
          return (
            <li key={f} className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--text-base)' }}>
              {trialOnly
                ? <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                : <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--c1)' }} />}
              <span>
                {featureT[f][lang]}
                {trialOnly && (
                  <span className="ml-1 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                    · {t('trial')}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mt-5 pt-1">
        {isCurrent ? (
          <p className="py-2.5 text-center text-xs font-semibold" style={{ color: 'var(--c1)' }}>
            {t('currentPlan')}
          </p>
        ) : onSelect ? (
          isSelfServe(tier) ? (
            <button type="button" onClick={() => onSelect(tier)}
              className="btn-primary w-full rounded-xl py-2.5 text-xs font-semibold">
              {t('choose')}
            </button>
          ) : tier === 'free' ? null : (
            <a href={telegramContactUrl('enterprise')} target="_blank" rel="noopener noreferrer"
              className="block w-full rounded-xl border py-2.5 text-center text-xs font-semibold"
              style={{ borderColor: 'var(--border2)', color: 'var(--text-base)' }}>
              {t('talkToUs')}
            </a>
          )
        ) : href ? (
          <a href={href}
            className={`block w-full rounded-xl py-2.5 text-center text-xs font-semibold ${isMatch ? 'btn-primary' : 'border'}`}
            style={isMatch ? undefined : { borderColor: 'var(--border2)', color: 'var(--text-base)' }}>
            {tier === 'free' ? t('start') : t('choose')}
          </a>
        ) : (
          <a href={telegramContactUrl('enterprise')} target="_blank" rel="noopener noreferrer"
            className="block w-full rounded-xl border py-2.5 text-center text-xs font-semibold"
            style={{ borderColor: 'var(--border2)', color: 'var(--text-base)' }}>
            {t('talkToUs')}
          </a>
        )}
      </div>
    </div>
  )
}
