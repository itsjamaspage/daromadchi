'use client'

/**
 * The «Настройки таблицы» panel: tick a column on, untick it off.
 *
 * Fourteen columns is a lot to read when you only came to check margin. The
 * seller decides which ones they actually use, and the choice sticks.
 */

import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal, Check, X } from 'lucide-react'
import {
  ANALYTICS_COLUMNS, COLUMN_KEYS, COLUMN_PRESETS,
  hiddenForPreset, isVisible, visibleCount,
} from '@/lib/products/analytics-columns'

interface Props {
  hidden: string[]
  onChange: (hidden: string[]) => void
  labels: {
    title: string
    button: string
    presetMinimal: string
    presetSales: string
    presetMoney: string
    presetAll: string
    /** Column display names, keyed by ColumnDef.labelKey — the same strings the
     *  table header uses, so the panel can never name a column differently. */
    columns: Record<string, string>
  }
}

const PRESET_ORDER: Array<{ id: keyof typeof COLUMN_PRESETS; labelKey: keyof Props['labels'] }> = [
  { id: 'minimal', labelKey: 'presetMinimal' },
  { id: 'sales',   labelKey: 'presetSales' },
  { id: 'money',   labelKey: 'presetMoney' },
  { id: 'all',     labelKey: 'presetAll' },
]

export default function AnalyticsTableSettings({ hidden, onChange, labels }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const toggle = (key: string) => {
    onChange(hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key])
  }

  const shown = visibleCount(hidden)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border transition-colors hover:bg-[var(--bg-input)]"
        style={{ borderColor: 'var(--border)', color: 'var(--text-dim)', background: 'var(--bg-card2)' }}
        aria-expanded={open}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: 'var(--c1)' }} />
        {labels.button}
        {/* The count is the fastest way to see you have columns switched off —
            otherwise a narrowed table looks like missing data. */}
        <span style={{ color: 'var(--text-muted)' }}>{shown}/{COLUMN_KEYS.length}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border shadow-xl overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>{labels.title}</span>
            <button onClick={() => setOpen(false)} aria-label="Close" style={{ color: 'var(--text-muted)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3 py-2.5 flex flex-wrap gap-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
            {PRESET_ORDER.map(p => (
              <button
                key={p.id}
                onClick={() => onChange(hiddenForPreset(p.id))}
                className="text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors hover:bg-[var(--bg-input)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              >
                {labels[p.labelKey] as string}
              </button>
            ))}
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {ANALYTICS_COLUMNS.map(c => {
              const on = isVisible(c.key, hidden)
              return (
                <button
                  key={c.key}
                  onClick={() => !c.locked && toggle(c.key)}
                  disabled={c.locked}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-input)] disabled:cursor-default disabled:opacity-60"
                  style={{ color: 'var(--text-base)' }}
                >
                  <span
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0 border"
                    style={on
                      ? { background: '#10b981', borderColor: '#10b981' }
                      : { borderColor: 'var(--border2)' }}
                  >
                    {on && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="flex-1 truncate">{labels.columns[c.labelKey] ?? c.key}</span>
                  {/* Saying WHY it cannot be unticked beats a checkbox that
                      silently refuses to move. */}
                  {c.locked && (
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
