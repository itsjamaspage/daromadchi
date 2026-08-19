'use client'

/**
 * The tier carousel — five cards a seller swipes through.
 *
 * Cards work here because a seller genuinely does choose: a new account has no
 * measured sales, so it picks a plan and the turnover measurement only moves it
 * later. The card that matches their turnover is badged, not enforced.
 *
 * Native scroll-snap rather than a carousel library: swipe, trackpad, shift+wheel,
 * keyboard and screen-reader order all come free from the browser, and the whole
 * list stays in the DOM so nothing is hidden from search engines or assistive tech.
 * The arrows are an affordance on top, not the mechanism.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
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
  /** Badge this tier without any input — the dashboard already knows it. */
  highlight?: Tier | null
  /** Show the "how much do you sell?" field above the cards. */
  showInput?: boolean
  /** In-app: make every self-serve card buyable instead of linking to checkout. */
  onSelect?: (tier: Tier) => void
  /** The tier the seller is already on. */
  currentTier?: Tier | null
}

export default function TierCards({
  lang, interval, highlight = null, showInput = true, onSelect, currentTier = null,
}: Props) {
  const t = (k: keyof typeof tiersT) => tiersT[k][lang]
  const [entered, setEntered] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const [active, setActive] = useState(0)

  const typedTurnover = useMemo(() => parseSom(entered), [entered])
  const matched: Tier | null = typedTurnover !== null ? assignTier(typedTurnover) : highlight

  // Which card is centred, and whether the arrows have anywhere left to go.
  // Read from scroll position rather than tracked separately, so a swipe, a
  // trackpad gesture and an arrow press all agree.
  const syncPosition = useCallback(() => {
    const el = scroller.current
    if (!el) return
    setAtStart(el.scrollLeft <= 2)
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 2)
    const centre = el.scrollLeft + el.clientWidth / 2
    let nearest = 0
    let best = Infinity
    cardRefs.current.forEach((card, i) => {
      if (!card) return
      const d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - centre)
      if (d < best) { best = d; nearest = i }
    })
    setActive(nearest)
  }, [])

  useEffect(() => {
    syncPosition()
    const el = scroller.current
    if (!el) return
    el.addEventListener('scroll', syncPosition, { passive: true })
    window.addEventListener('resize', syncPosition)
    return () => {
      el.removeEventListener('scroll', syncPosition)
      window.removeEventListener('resize', syncPosition)
    }
  }, [syncPosition])

  const scrollToCard = useCallback((i: number) => {
    const card = cardRefs.current[i]
    const el = scroller.current
    if (!card || !el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({
      left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2,
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [])

  // Typing a turnover brings the matching card into view — the "that's me"
  // moment only lands if the card is actually on screen.
  useEffect(() => {
    if (typedTurnover === null || !matched) return
    scrollToCard(LADDER.indexOf(matched))
  }, [typedTurnover, matched, scrollToCard])

  const step = (dir: -1 | 1) => scrollToCard(Math.min(LADDER.length - 1, Math.max(0, active + dir)))

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

      <div className="relative">
        {/* Arrows are desktop-only: on a touch screen the swipe IS the control,
            and a floating chevron just covers a card. */}
        <ArrowButton side="left" disabled={atStart} onClick={() => step(-1)} label={t('prevTier')} />
        <ArrowButton side="right" disabled={atEnd} onClick={() => step(1)} label={t('nextTier')} />

        <div
          ref={scroller}
          role="group"
          aria-label={t('eyebrow')}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2
                     [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {LADDER.map((tier, i) => {
            const priceTiyin = tierPriceTiyin(tier, interval)
            const href = tierCheckoutHref(tier, interval)
            const isMatch = matched === tier
            const isCurrent = tier === currentTier
            return (
              <div
                key={tier}
                ref={el => { cardRefs.current[i] = el }}
                aria-current={isMatch ? 'true' : undefined}
                className="flex w-[78%] shrink-0 snap-center flex-col rounded-2xl border p-5 transition-colors
                           sm:w-[46%] lg:w-[31%]"
                style={{
                  background: 'var(--bg-card2)',
                  borderColor: isMatch ? 'var(--c1)' : 'var(--border)',
                  boxShadow: isMatch ? '0 0 0 1px var(--c1)' : undefined,
                }}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-base font-bold" style={{ color: 'var(--text-base)' }}>
                    {t(TIER_LABEL[tier])}
                  </span>
                  {isMatch && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                      style={{ background: 'var(--c1)', color: '#fff' }}>
                      {t('recommended')}
                    </span>
                  )}
                </div>

                {/* Turnover stays on the card: it is still the thing that decides
                    which tier fits, even when the seller is choosing. */}
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('colTurnover')}: <span className="tabular-nums">{rangeLabel(tier, lang)}</span>
                </p>

                <div className="my-4">
                  {priceTiyin === null ? (
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-muted)' }}>{t('contact')}</p>
                  ) : (
                    <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-base)' }}>
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
                  <p className="mb-3 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'rgba(47,109,246,0.12)', color: 'var(--c1)' }}>
                    <Check className="h-3 w-3" /> {t('trialBadge')}
                  </p>
                )}

                <div className="mt-auto pt-2">
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
                      <a href="https://t.me/daromadchi_uz" target="_blank" rel="noopener noreferrer"
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
                    <a href="https://t.me/daromadchi_uz" target="_blank" rel="noopener noreferrer"
                      className="block w-full rounded-xl border py-2.5 text-center text-xs font-semibold"
                      style={{ borderColor: 'var(--border2)', color: 'var(--text-base)' }}>
                      {t('talkToUs')}
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Dots double as controls, so the carousel is operable without a swipe. */}
        <div className="mt-3 flex justify-center gap-1.5">
          {LADDER.map((tier, i) => (
            <button
              key={tier}
              type="button"
              onClick={() => scrollToCard(i)}
              aria-label={t(TIER_LABEL[tier])}
              aria-current={i === active ? 'true' : undefined}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === active ? 20 : 6,
                background: i === active ? 'var(--c1)' : 'var(--border2)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ArrowButton({ side, disabled, onClick, label }: {
  side: 'left' | 'right'; disabled: boolean; onClick: () => void; label: string
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`absolute top-[42%] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center
                  rounded-full border shadow-sm transition-opacity lg:flex
                  ${side === 'left' ? '-left-4' : '-right-4'}
                  ${disabled ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-base)' }}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
