'use client'

import { useState } from 'react'
import { X, Trophy } from 'lucide-react'
import { useLang } from '@/app/providers'
import { nudgeT } from '@/lib/nudgeT'
import { tiersT } from '@/lib/tiersT'
import { TELEGRAM_CONTACT_URL } from '@/lib/contact'

const som = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/**
 * The one nudge that is a popup rather than a banner.
 *
 * Every other nudge sits above the page precisely so it does not interrupt —
 * this one interrupts on purpose. It fires at 90 % of the Biznes ceiling, which
 * for a real account happens roughly once, and the thing being said cannot be
 * self-served: past this volume the terms are negotiated, so the useful outcome
 * is a conversation, not a click on a price. A banner asking someone to start a
 * conversation is a banner that gets scrolled past.
 *
 * It says plainly that nothing changes automatically. A seller who has just been
 * told their turnover is off the top of the ladder should not have to wonder
 * whether they are about to be charged for it.
 */
export default function EnterpriseOutreachModal({ detail }: { detail: Record<string, unknown> | null }) {
  const { lang } = useLang()
  const t = (k: keyof typeof nudgeT) => nudgeT[k][lang]
  const [open, setOpen] = useState(true)

  if (!open) return null

  const turnover = typeof detail?.turnoverSom === 'number' ? detail.turnoverSom : null

  function close() {
    setOpen(false)
    void fetch('/api/notices/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'enterprise_outreach' }),
    }).catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      role="dialog" aria-modal="true" aria-labelledby="ent-title">
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)' }}>
        <div className="flex items-start justify-between gap-4 p-6 pb-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border flex-shrink-0"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--c1)' }}>
            <Trophy className="h-5 w-5" />
          </div>
          <button type="button" onClick={close} aria-label={t('later')}
            className="p-1 -mt-1 -mr-1" style={{ color: 'var(--text-muted)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 pt-4 space-y-3">
          <h3 id="ent-title" className="font-bold text-base leading-snug" style={{ color: 'var(--text-base)' }}>
            {t('enterpriseTitle')}
          </h3>
          {turnover !== null && (
            <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--c1)' }}>
              {nudgeT.over30Days[lang]} {som(turnover)} {tiersT.som[lang]}
            </p>
          )}
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {t('enterpriseBody')}
          </p>
        </div>

        <div className="flex gap-2 p-4 pt-0">
          <a href={TELEGRAM_CONTACT_URL} target="_blank" rel="noopener noreferrer"
            onClick={close}
            className="flex-1 btn-primary rounded-xl py-2.5 text-center text-sm font-semibold">
            {t('talkToUs')}
          </a>
          <button type="button" onClick={close}
            className="flex-1 rounded-xl border py-2.5 text-sm font-semibold"
            style={{ borderColor: 'var(--border2)', color: 'var(--text-muted)' }}>
            {t('later')}
          </button>
        </div>
      </div>
    </div>
  )
}
