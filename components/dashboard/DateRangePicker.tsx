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

export default function DateRangePicker({ period, from, to }: Props) {
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

  const PRESETS = [
    { label: lang === 'uz' ? '30 kun' : '30 дн.',  days: '30'  },
    { label: lang === 'uz' ? '90 kun' : '90 дн.',  days: '90'  },
    { label: lang === 'uz' ? '1 yil'  : '1 год',   days: '365' },
  ]

  const activeDays = !from && !to ? (period ?? '365') : null

  const label = from && to
    ? `${formatDateLabel(from)} — ${formatDateLabel(to)}`
    : lang === 'ru' ? 'Выбрать период' : lang === 'uz' ? 'Davr tanlash' : 'Select period'

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
          background: open ? 'rgba(131,192,249,0.12)' : 'var(--bg-input)',
          borderColor: open ? 'rgba(131,192,249,0.35)' : 'var(--border)',
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
          {/* Quick presets */}
          <div className="flex gap-1.5">
            {PRESETS.map(({ label: pl, days }) => (
              <button
                key={days}
                onClick={() => applyPreset(days)}
                disabled={pending}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 disabled:opacity-60"
                style={{
                  background: activeDays === days ? 'rgba(131,192,249,0.18)' : 'var(--bg-input)',
                  border: activeDays === days ? '1px solid rgba(131,192,249,0.4)' : '1px solid var(--border)',
                  color: activeDays === days ? 'var(--c1)' : 'var(--text-muted)',
                }}
              >
                {pending && activeDays === days && <Spinner className="w-3 h-3" />}
                {pl}
              </button>
            ))}
          </div>
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
            style={{ background: '#83c0f9', color: '#131321' }}
          >
            {pending && <Spinner className="w-4 h-4" />}
            {lang === 'uz' ? 'Qo\'llash' : lang === 'ru' ? 'Применить' : 'Apply'}
          </button>
        </div>
      )}
    </div>
  )
}
