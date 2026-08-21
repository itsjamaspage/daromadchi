/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { CalendarDays } from 'lucide-react'
import { useLang } from '@/app/providers'

interface Props {
  period: string
  from?: string
  to?: string
  /**
   * Which preset chips to show, by `days` key. Omit for the default set; pass
   * [] for a dates-only picker on a page whose default range is fixed in code.
   */
  presets?: string[]
  /** Button text when no custom range is set — the host page's own default. */
  fallbackLabel?: string
}

function formatDateLabel(date: string) {
  return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function defaultFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 29)
  return d.toISOString().slice(0, 10)
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? 'w-4 h-4'}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export default function DateRangePicker({ period, from, to, presets, fallbackLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(from ?? defaultFrom())
  const [customTo, setCustomTo]     = useState(to ?? todayStr())
  const ref = useRef<HTMLDivElement>(null)
  const shouldCloseAfterPending = useRef(false)

  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const { lang } = useLang()

  // Close the dropdown once the transition finishes
  useEffect(() => {
    if (!pending && shouldCloseAfterPending.current) {
      shouldCloseAfterPending.current = false
      setOpen(false)
    }
  }, [pending])

  useEffect(() => {
    setCustomFrom(from ?? defaultFrom())
    setCustomTo(to ?? todayStr())
  }, [from, to])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function apply() {
    if (!customFrom || !customTo) return
    const p = new URLSearchParams(searchParams.toString())
    p.delete('days')
    p.set('from', customFrom)
    p.set('to', customTo)
    shouldCloseAfterPending.current = true
    startTransition(() => {
      router.push(`${pathname}?${p.toString()}`, { scroll: false })
    })
  }

  function applyPreset(days: string) {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('from')
    p.delete('to')
    p.set('days', days)
    shouldCloseAfterPending.current = true
    startTransition(() => {
      router.push(`${pathname}?${p.toString()}`, { scroll: false })
    })
  }

  const ALL_PRESETS = [
    { label: lang === 'uz' ? 'Bugun' : lang === 'ru' ? 'Сегодня' : 'Today', days: '1'   },
    { label: lang === 'uz' ? '7 kun' : lang === 'ru' ? '7 дн.'   : '7 days', days: '7'  },
    { label: lang === 'uz' ? '30 kun' : lang === 'ru' ? '30 дн.' : '30 days', days: '30' },
    { label: lang === 'uz' ? '90 kun' : lang === 'ru' ? '90 дн.' : '90 days', days: '90' },
    { label: lang === 'uz' ? '1 yil'  : lang === 'ru' ? '1 год'  : '1 year',  days: '365'},
  ]
  // An empty list is a real choice — a page with a fixed default range wants
  // the date inputs and no chips — so this checks for undefined, not falsiness.
  const PRESETS = presets === undefined
    ? ALL_PRESETS
    : presets.map(k => ALL_PRESETS.find(p => p.days === k)).filter((p): p is typeof ALL_PRESETS[number] => !!p)

  const activeDays = !from && !to ? period : null

  const PRESET_LABELS: Record<string, Record<string, string>> = {
    '30':  { uz: '30 kun', ru: '30 дн.', en: '30 days' },
    '90':  { uz: '90 kun', ru: '90 дн.', en: '90 days' },
    '365': { uz: '1 yil',  ru: '1 год',  en: '1 year'  },
    '1':   { uz: '1 kun',  ru: '1 день', en: 'Today'   },
    '7':   { uz: '7 kun',  ru: '7 дн.',  en: '7 days'  },
  }

  const label = from && to
    ? `${formatDateLabel(from)} — ${formatDateLabel(to)}`
    : (PRESET_LABELS[period]?.[lang] ?? PRESET_LABELS[period]?.en)
      // A host page whose default range is fixed in code has no preset to name
      // it, so it supplies the label itself — otherwise the button would read
      // "Выбрать период" while a range was very much already in effect.
      ?? fallbackLabel
      ?? (lang === 'ru' ? 'Выбрать период' : lang === 'uz' ? 'Davr tanlash' : 'Select period')

  const inputStyle = {
    background: 'var(--bg-input)',
    borderColor: 'var(--border)',
    color: 'var(--text-base)',
    colorScheme: 'light' as const,
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={pending}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${pending ? 'opacity-60 cursor-not-allowed' : ''}`}
        style={{
          background: open ? 'var(--bg-card2)' : 'var(--bg-input)',
          borderColor: open ? 'var(--border)' : 'var(--border)',
        }}
      >
        {pending
          ? <Spinner className="w-3.5 h-3.5 shrink-0" />
          : <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--c1)' }} />
        }
        <span style={{ color: 'var(--text-base)' }}>{label}</span>
      </button>

      {open && (
        <div
          className="fixed left-4 right-4 sm:absolute sm:left-auto sm:right-0 sm:w-auto top-[4.5rem] sm:top-full sm:mt-2 z-50 rounded-2xl border shadow-2xl p-4 space-y-3"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', minWidth: 240 }}
        >
          {/* Quick presets — wrap so all fit on narrow dropdowns */}
          {PRESETS.length > 0 && <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(({ label: pl, days }) => (
              <button
                key={days}
                onClick={() => applyPreset(days)}
                disabled={pending}
                className="flex-1 min-w-[60px] py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 disabled:opacity-60"
                style={{
                  background: activeDays === days ? 'var(--bg-card2)' : 'var(--bg-input)',
                  border: activeDays === days ? '1px solid var(--border)' : '1px solid var(--border)',
                  color: activeDays === days ? 'var(--c1)' : 'var(--text-muted)',
                }}
              >
                {pending && activeDays === days && <Spinner className="w-3 h-3" />}
                {pl}
              </button>
            ))}
          </div>}
          <div className="flex flex-col gap-2">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Начало' : lang === 'uz' ? 'Boshlanish' : 'From'}
              </p>
              <input
                type="date"
                value={customFrom}
                max={customTo || todayStr()}
                onChange={e => setCustomFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                style={inputStyle}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Конец' : lang === 'uz' ? 'Tugash' : 'To'}
              </p>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayStr()}
                onChange={e => setCustomTo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                style={inputStyle}
              />
            </div>
          </div>
          <button
            onClick={apply}
            disabled={!customFrom || !customTo || pending}
            className="w-full py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: 'var(--c1)', color: '#131321' }}
          >
            {pending && <Spinner className="w-4 h-4" />}
            {lang === 'uz' ? 'Qo\'llash' : lang === 'ru' ? 'Применить' : 'Apply'}
          </button>
        </div>
      )}
    </div>
  )
}
