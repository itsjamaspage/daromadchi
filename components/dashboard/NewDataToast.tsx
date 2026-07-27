'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

interface Props {
  visible: boolean
  onRefresh: () => void
}

export default function NewDataToast({ visible, onRefresh }: Props) {
  if (!visible) return null
  return <NewDataToastInner onRefresh={onRefresh} />
}

function NewDataToastInner({ onRefresh }: { onRefresh: () => void }) {
  const { lang } = useLang()
  const d = dashT[lang].dashboard
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDismissed(true), 30_000)
    return () => clearTimeout(timer)
  }, [])

  if (dismissed) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50" style={{ animation: 'slideUpIn 0.3s ease-out' }}>
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-lg bg-[var(--bg-card2)] border-[var(--border)]">
        <span className="text-sm text-[var(--text-base)]">{d.newDataAvailable}</span>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          style={{ background: 'var(--c1)', color: 'white' }}
        >
          <RefreshCw className="w-3 h-3" />
          {d.refreshBtn}
        </button>
      </div>
    </div>
  )
}
