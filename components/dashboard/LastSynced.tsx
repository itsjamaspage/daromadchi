'use client'

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
  const { lang } = useLang()
  const d = dashT[lang].dashboard

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
    </div>
  )
}
