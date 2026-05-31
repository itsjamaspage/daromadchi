'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

function isNoToken(res: Response, data: { error?: string }): boolean {
  return res.status === 400 && typeof data.error === 'string' && data.error.toLowerCase().includes('token')
}

export default function SyncButton() {
  const router = useRouter()
  const { lang } = useLang()
  const d = dashT[lang].dashboard
  const [state, setState] = useState<'idle' | 'syncing' | 'ok' | 'err'>('idle')

  async function handleSync() {
    setState('syncing')

    const endpoints = ['/api/uzum/sync', '/api/yandex/sync', '/api/wildberries/sync']

    const results = await Promise.allSettled(
      endpoints.map(async (url) => {
        const res = await fetch(url, { method: 'POST' })
        const data = await res.json()
        return { res, data }
      })
    )

    let anySuccess = false
    let anyRealError = false

    for (const result of results) {
      if (result.status === 'rejected') {
        anyRealError = true
      } else {
        const { res, data } = result.value
        if (data.ok) {
          anySuccess = true
        } else if (!isNoToken(res, data)) {
          anyRealError = true
        }
      }
    }

    if (anyRealError && !anySuccess) {
      setState('err')
    } else {
      setState('ok')
      router.refresh()
      setTimeout(() => setState('idle'), 3000)
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={state === 'syncing'}
      title="Barcha marketplacelarni sinxronlash"
      className={`hidden sm:flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border transition-all ${
        state === 'ok'
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          : state === 'err'
          ? 'bg-red-500/10 border-red-500/20 text-red-400'
          : 'bg-[var(--bg-input)] border-[var(--border2)] text-slate-400 hover:text-white'
      }`}
    >
      {state === 'syncing' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
      {state === 'ok'      && <CheckCircle className="w-3.5 h-3.5" />}
      {state === 'err'     && <XCircle className="w-3.5 h-3.5" />}
      {state === 'idle'    && <RefreshCw className="w-3.5 h-3.5" />}
      {state === 'syncing' ? d.syncing : state === 'ok' ? d.done : state === 'err' ? d.err : d.sync}
    </button>
  )
}
