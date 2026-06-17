'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Calendar, X } from 'lucide-react'

interface Labels {
  label: string
  p30: string; p90: string; p180: string; p365: string; p730: string; pAll: string
  apply: string; clear: string
}

const PRESETS = [
  { value: '30',  key: 'p30'  },
  { value: '90',  key: 'p90'  },
  { value: '180', key: 'p180' },
  { value: '365', key: 'p365' },
  { value: '730', key: 'p730' },
] as const

export default function PeriodSelector({
  currentDays,
  currentFrom,
  currentTo,
  labels,
}: {
  currentDays: number | null
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

  function goPreset(days: string) {
    const p = base(); p.set('days', days)
    setShowPicker(false)
    router.push(`${pathname}?${p.toString()}`, { scroll: false })
  }

  function goAll() {
    router.push(`${pathname}?${base().toString()}`, { scroll: false })
    setShowPicker(false); setFromVal(''); setToVal('')
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

  const activePreset = !hasCustom && currentDays !== null ? String(currentDays) : null
  const noneActive   = !hasCustom && currentDays === null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset pills */}
      <div className="flex items-center gap-1 p-1 rounded-xl border" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
        {PRESETS.map(({ value, key }) => (
          <button
            key={value}
            onClick={() => goPreset(value)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              activePreset === value
                ? 'bg-violet-600/20 text-[var(--c1)] border border-violet-500/30'
                : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
            }`}
          >
            {labels[key]}
          </button>
        ))}
        <button
          onClick={goAll}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
            noneActive
              ? 'bg-violet-600/20 text-[var(--c1)] border border-violet-500/30'
              : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
          }`}
        >
          {labels.pAll}
        </button>
      </div>

      {/* Calendar toggle */}
      <button
        onClick={() => setShowPicker(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
          hasCustom
            ? 'bg-violet-600/20 text-[var(--c1)] border-violet-500/30'
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
            className="text-xs font-semibold px-3 py-1 rounded-lg transition-all disabled:opacity-40"
            style={{ background: '#7c3aed', color: 'white' }}
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
