'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, X, RefreshCw } from 'lucide-react'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'
import type { SyncAlert as SyncAlertType } from '@/lib/db/shop-context'

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
        fetch('/api/wildberries/sync', { method: 'POST' }),
      ])
      router.refresh()
    } finally {
      setSyncing(false)
    }
  }

  const hasError = alerts.some(a => a.status === 'error')

  return (
    <div className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${
      hasError
        ? 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20'
        : 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20'
    }`}>
      <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${hasError ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`} />
      <div className="flex-1 min-w-0">
        {alerts.map((a, i) => (
          <p key={i} className={`text-xs ${hasError ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
            <span className="font-semibold">{a.shopName}:</span>{' '}
            {a.status === 'error' ? d.syncAlertError : d.syncAlertPartial}
          </p>
        ))}
      </div>
      <button
        onClick={handleSync}
        disabled={syncing}
        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all flex-shrink-0 ${
          hasError
            ? 'border-red-300 text-red-600 hover:text-red-800 dark:border-red-500/30 dark:text-red-300 dark:hover:text-red-200'
            : 'border-amber-300 text-amber-600 hover:text-amber-800 dark:border-amber-500/30 dark:text-amber-300 dark:hover:text-amber-200'
        } disabled:opacity-50`}
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
