'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Calendar, X } from 'lucide-react'

interface Labels {
  label: string
  apply: string
  clear: string
}

export default function PeriodSelector({
  currentFrom,
  currentTo,
  labels,
}: {
  currentFrom: string | null
  currentTo: string | null
  labels: Labels
}) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const hasCustom = !!(currentFrom && currentTo)

  const [showPicker, setShowPicker] = useState(hasCustom)
  const [fromVal,    setFromVal]    = useState(currentFrom ?? '')
  const [toVal,      setToVal]      = useState(currentTo ?? '')

  function base() {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('days'); p.delete('from'); p.delete('to')
    return p
  }

  function applyCustom() {
    if (!fromVal || !toVal) return
    const p = base(); p.set('from', fromVal); p.set('to', toVal)
    router.push(`${pathname}?${p.toString()}`, { scroll: false })
    setShowPicker(false)
  }

  function clearCustom() {
    setFromVal(''); setToVal('')
    router.push(`${pathname}?${base().toString()}`, { scroll: false })
    setShowPicker(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Calendar toggle */}
      <button
        onClick={() => setShowPicker(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
          hasCustom
            ? 'bg-[var(--bg-card2)] text-[var(--c1)] border-[var(--border)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-dim)] border-[var(--border)]'
        }`}
        style={{ background: hasCustom ? undefined : 'var(--bg-card2)' }}
      >
        <Calendar className="w-3.5 h-3.5" />
        {hasCustom ? `${currentFrom} → ${currentTo}` : labels.label}
      </button>

      {/* Custom date picker */}
      {showPicker && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
          <input
            type="date"
            value={fromVal}
            onChange={e => setFromVal(e.target.value)}
            className="text-xs rounded-lg px-2 py-1 border"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-base)' }}
          />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
          <input
            type="date"
            value={toVal}
            onChange={e => setToVal(e.target.value)}
            min={fromVal || undefined}
            className="text-xs rounded-lg px-2 py-1 border"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-base)' }}
          />
          <button
            onClick={applyCustom}
            disabled={!fromVal || !toVal}
            className="text-xs font-semibold px-3 py-1 rounded-lg transition-all disabled:opacity-40 btn-primary"
          >
            {labels.apply}
          </button>
          {(fromVal || toVal || hasCustom) && (
            <button onClick={clearCustom} className="text-[var(--text-muted)] hover:text-[var(--text-base)]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
