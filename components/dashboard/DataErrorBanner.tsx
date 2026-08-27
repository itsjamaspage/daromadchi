'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, X, RefreshCw } from 'lucide-react'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'
import type { PanelKey } from '@/app/dashboard/DashboardClient'

interface Props {
  panels: PanelKey[]
}

// Says which panels are missing because their query threw — as distinct from
// being empty. The dashboard degrades one panel rather than 500ing the page,
// which is right; what was missing is that the seller had no way to tell a
// broken panel from a quiet week. A zero that means "we don't know" is the
// same failure this codebase has been chasing out of the money layer.
export default function DataErrorBanner({ panels }: Props) {
  const router = useRouter()
  const { lang } = useLang()
  const d = dashT[lang].dashboard
  const [dismissed, setDismissed] = useState(false)
  const [pending, startTransition] = useTransition()

  if (dismissed || panels.length === 0) return null

  const LABELS: Record<PanelKey, string> = {
    kpis:         d.panelKpis,
    orders:       d.panelOrders,
    products:     d.panelProducts,
    productSales: d.panelProductSales,
    chart:        d.panelChart,
    categories:   d.panelCategories,
  }
  const names = panels.map(p => LABELS[p] ?? p).join(', ')

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl px-4 py-3 border"
      style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: '#b91c1c' }}>{d.loadFailedTitle}</p>
        <p className="text-xs mt-0.5" style={{ color: '#b91c1c' }}>
          {d.loadFailedBody.replace('{panels}', names)}
        </p>
      </div>
      <button
        onClick={() => startTransition(() => router.refresh())}
        disabled={pending}
        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all flex-shrink-0 disabled:opacity-50"
        style={{ borderColor: 'rgba(239,68,68,0.25)', color: '#b91c1c' }}
      >
        <RefreshCw className={`w-3 h-3 ${pending ? 'animate-spin' : ''}`} />
        {d.loadFailedRetry}
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="dismiss"
        className="text-[var(--text-muted)] hover:text-[var(--text-base)] flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
