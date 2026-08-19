'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X, Clock, Lock, TrendingUp } from 'lucide-react'
import { useLang } from '@/app/providers'
import { nudgeT } from '@/lib/nudgeT'
import { tiersT } from '@/lib/tiersT'

export interface NudgeProps {
  kind: string
  detail: Record<string, unknown> | null
}

const som = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
const TIER_NAME: Record<string, string> = {
  pro: 'Pro', pro_plus: 'Pro+', biznes: 'Biznes', enterprise: 'Enterprise',
}

/**
 * The in-app half of a nudge.
 *
 * Dismissible, and it stays dismissed: the sweep only brings it back when the
 * condition genuinely recurs. It never blocks the page — a seller who has just
 * been told their trial is ending is trying to use the product, not read a
 * modal — so this is a banner above the content, not an overlay.
 *
 * Optimistically hidden on dismiss. The worst case if the request fails is that
 * the banner returns on the next page load, which is the harmless direction.
 */
export default function NudgeBanner({ kind, detail }: NudgeProps) {
  const { lang } = useLang()
  const t = (k: keyof typeof nudgeT) => nudgeT[k][lang]
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  function dismiss() {
    setHidden(true)
    void fetch('/api/notices/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    }).catch(() => {})
  }

  const daysLeft = typeof detail?.daysLeft === 'number' ? detail.daysLeft : null
  const turnover = typeof detail?.turnoverSom === 'number' ? detail.turnoverSom : null
  const tier = typeof detail?.tier === 'string' ? detail.tier : null

  let Icon = Clock
  let title = ''
  let body = ''
  let extra: string | null = null

  if (kind === 'trial_ending') {
    Icon = Clock
    title = t('trialEndingTitle')
    body = t('trialEndingBody')
    if (daysLeft !== null) extra = `${t('daysLeft')} ${daysLeft}`
  } else if (kind === 'trial_ended') {
    Icon = Lock
    title = t('trialEndedTitle')
    body = t('trialEndedBody')
  } else if (kind === 'outgrew_free') {
    Icon = TrendingUp
    title = t('outgrewTitle')
    body = t('outgrewBody')
    if (turnover !== null) {
      const name = tier ? TIER_NAME[tier] ?? tier : null
      extra = `${t('over30Days')} ${som(turnover)} ${tiersT.som[lang]}`
        + (name ? ` · ${t('suggestedTier')} ${name}` : '')
    }
  } else {
    // An unknown kind means the sweep learned something this build did not.
    // Showing an empty box would be worse than showing nothing.
    return null
  }

  return (
    <div className="mb-5 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
      style={{
        background: 'color-mix(in srgb, var(--c1) 8%, var(--bg-card2))',
        border: '1px solid color-mix(in srgb, var(--c1) 30%, transparent)',
      }}>
      <Icon className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--c1)' }} />

      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>{title}</p>
        {extra && (
          <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--c1)' }}>{extra}</p>
        )}
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{body}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Link href="/dashboard/billing"
          className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap">
          {t('choosePlan')}
        </Link>
        <button type="button" onClick={dismiss} aria-label={t('dismiss')}
          className="rounded-xl border p-2 transition-colors"
          style={{ borderColor: 'var(--border2)', color: 'var(--text-muted)' }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
