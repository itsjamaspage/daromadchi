'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

export default function SyncButton() {
  const router = useRouter()
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const [state, setState] = useState<'idle' | 'syncing' | 'ok' | 'err'>('idle')

  async function handleSync() {
    setState('syncing')
    try {
      const res = await fetch('/api/uzum/sync', { method: 'POST' })
      const data = await res.json()
      setState(data.ok ? 'ok' : 'err')
      if (data.ok) {
        router.refresh()
        setTimeout(() => setState('idle'), 3000)
      }
    } catch {
      setState('err')
    }
  }

  const label = state === 'syncing' ? d.syncing : state === 'ok' ? d.syncDone : state === 'err' ? d.syncError : d.sync

  return (
    <button
      onClick={handleSync}
      disabled={state === 'syncing'}
      title={d.syncTitle}
      className={`hidden sm:flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border transition-all ${
        state === 'ok'
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          : state === 'err'
          ? 'bg-red-500/10 border-red-500/20 text-red-400'
          : 'bg-[var(--bg-input)] border-[var(--border2)] text-[var(--text-muted)] hover:text-[var(--text-base)]'
      }`}
    >
      {state === 'syncing' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
      {state === 'ok'      && <CheckCircle className="w-3.5 h-3.5" />}
      {state === 'err'     && <XCircle className="w-3.5 h-3.5" />}
      {state === 'idle'    && <RefreshCw className="w-3.5 h-3.5" />}
      {label}
    </button>
  )
}
