'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

interface Props {
  lastSyncedAt: string | null
  lastSyncFailed: boolean
}

function relativeTime(iso: string, d: Record<string, string>): { text: string; warn: boolean } {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return { text: `${d.syncedAgo} <1 ${d.syncedMinAgo}`, warn: false }
  if (min < 60) return { text: `${d.syncedAgo} ${min} ${d.syncedMinAgo}`, warn: false }
  const hr = Math.floor(min / 60)
  if (hr < 24) return { text: `${d.syncedAgo} ${hr} ${d.syncedHrAgo}`, warn: hr >= 2 }
  const day = Math.floor(hr / 24)
  return { text: `${d.syncedAgo} ${day} ${d.syncedDayAgo}`, warn: true }
}

export default function LastSynced({ lastSyncedAt, lastSyncFailed }: Props) {
  const router = useRouter()
  const { lang } = useLang()
  const d = dashT[lang].dashboard
  const [syncing, setSyncing] = useState(false)

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

  let label: string
  let warn = false
  let failed = false

  if (lastSyncFailed) {
    label = d.syncFailed
    failed = true
  } else if (!lastSyncedAt) {
    label = d.notSyncedYet
  } else {
    const r = relativeTime(lastSyncedAt, d)
    label = r.text
    warn = r.warn
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={
        failed ? 'text-red-400' :
        warn ? 'text-amber-400' :
        'text-[var(--text-muted)]'
      }>
        {label}
      </span>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border transition-all bg-[var(--bg-input)] border-[var(--border2)] text-[var(--text-muted)] hover:text-[var(--text-base)] disabled:opacity-50"
      >
        <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
        {d.syncNow}
      </button>
    </div>
  )
}
