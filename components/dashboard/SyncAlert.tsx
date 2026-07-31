'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, X, RefreshCw } from 'lucide-react'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'
import type { SyncAlert as SyncAlertType } from '@/lib/db/shop-context'
import { WB_ENABLED } from '@/lib/feature-flags'

interface Props {
  alerts: SyncAlertType[]
}

export default function SyncAlert({ alerts }: Props) {
  const router = useRouter()
  const { lang } = useLang()
  const d = dashT[lang].dashboard
  const [dismissed, setDismissed] = useState(false)
  const [syncing, setSyncing] = useState(false)

  if (dismissed || alerts.length === 0) return null

  async function handleSync() {
    setSyncing(true)
    try {
      await Promise.allSettled([
        fetch('/api/uzum/sync', { method: 'POST' }),
        fetch('/api/yandex/sync', { method: 'POST' }),
        ...(WB_ENABLED ? [fetch('/api/wildberries/sync', { method: 'POST' })] : []),
      ])
      router.refresh()
    } finally {
      setSyncing(false)
    }
  }

  const hasError = alerts.some(a => a.status === 'error')

  const bg = hasError ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)'
  const border = hasError ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'
  const fg = hasError ? '#b91c1c' : '#92400e'

  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3 border"
      style={{ background: bg, borderColor: border }}>
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: hasError ? '#ef4444' : '#f59e0b' }} />
      <div className="flex-1 min-w-0">
        {alerts.map((a, i) => (
          <p key={i} className="text-xs font-medium" style={{ color: fg }}>
            <span className="font-semibold">{a.shopName}:</span>{' '}
            {a.status === 'error' ? d.syncAlertError : d.syncAlertPartial}
          </p>
        ))}
      </div>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all flex-shrink-0 disabled:opacity-50"
        style={{ borderColor: border, color: fg }}
      >
        <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
        {d.syncNow}
      </button>
      <button onClick={() => setDismissed(true)} className="text-[var(--text-muted)] hover:text-[var(--text-base)] flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
