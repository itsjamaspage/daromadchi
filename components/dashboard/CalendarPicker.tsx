'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useLang } from '@/app/providers'

interface Props {
  from?: string
  to?: string
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? 'w-4 h-4'}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export default function CalendarPicker({ from, to }: Props) {
  const { lang } = useLang()
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const wrapRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const initialFrom = from ? fromISODate(from) : null
  const initialTo   = to ? fromISODate(to) : null
  const [selFrom, setSelFrom] = useState<Date | null>(initialFrom)
  const [selTo,   setSelTo]   = useState<Date | null>(initialTo)
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(initialFrom ?? initialTo ?? new Date()))

  useEffect(() => {
    if (!open) {
      setSelFrom(initialFrom)
      setSelTo(initialTo)
      setViewMonth(startOfMonth(initialFrom ?? initialTo ?? new Date()))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Locale-aware weekday headers, Monday-first (matches uz/ru convention).
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ'
  const weekdayShort: string[] = []
  {
    const anchorMon = new Date(2024, 0, 1) // Monday
    for (let i = 0; i < 7; i++) {
      const d = new Date(anchorMon)
      d.setDate(anchorMon.getDate() + i)
      const name = d.toLocaleDateString(locale, { weekday: 'short' })
      weekdayShort.push(name.charAt(0).toUpperCase() + name.slice(1))
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function onDayClick(d: Date) {
    if (d > today) return
    if (!selFrom || (selFrom && selTo)) {
      // Start a new range.
      setSelFrom(d)
      setSelTo(null)
      return
    }
    // Second click. If earlier than the current from, swap.
    if (d < selFrom) {
      setSelTo(selFrom)
      setSelFrom(d)
    } else {
      setSelTo(d)
    }
  }

  function inRange(d: Date): boolean {
    if (!selFrom) return false
    const end = selTo ?? selFrom
    return d >= selFrom && d <= end
  }

  function apply() {
    const rangeFrom = selFrom ?? new Date()
    const rangeTo   = selTo ?? selFrom ?? new Date()
    const p = new URLSearchParams(searchParams.toString())
    p.delete('days')
    p.set('from', toISODate(rangeFrom))
    p.set('to',   toISODate(rangeTo))
    startTransition(() => {
      router.push(`${pathname}?${p.toString()}`, { scroll: false })
      setOpen(false)
    })
  }

  function clear() {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('days')
    p.delete('from')
    p.delete('to')
    startTransition(() => {
      router.push(`${pathname}?${p.toString()}`, { scroll: false })
      setOpen(false)
    })
  }

  const monthTitle = (() => {
    const name = viewMonth.toLocaleDateString(locale, { month: 'long' })
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${viewMonth.getFullYear()}`
  })()

  // Build the 6×7 grid. Monday-first: shift Sunday(0)→7.
  const firstDay = startOfMonth(viewMonth)
  const totalDays = daysInMonth(viewMonth)
  const leadDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1

  const cells: (Date | null)[] = []
  for (let i = 0; i < leadDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d))
  while (cells.length % 7 !== 0) cells.push(null)

  const buttonLabel = (() => {
    if (from && to) {
      const a = fromISODate(from).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
      const b = fromISODate(to).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
      return `${a} — ${b}`
    }
    return lang === 'ru' ? 'Выбрать даты' : lang === 'uz' ? 'Sanalarni tanlash' : 'Pick dates'
  })()

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={pending}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${pending ? 'opacity-60 cursor-not-allowed' : ''}`}
        style={{
          background: open ? 'var(--bg-card2)' : 'var(--bg-input)',
          borderColor: 'var(--border)',
        }}
      >
        {pending
          ? <Spinner className="w-3.5 h-3.5 shrink-0" />
          : <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--c1)' }} />
        }
        <span style={{ color: 'var(--text-base)' }}>{buttonLabel}</span>
      </button>

      {open && (
        <div
          className="fixed left-4 right-4 sm:absolute sm:left-auto sm:right-0 sm:w-[320px] top-[4.5rem] sm:top-full sm:mt-2 z-50 rounded-2xl border shadow-2xl p-4"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          {/* Month/year navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              <select
                value={viewMonth.getMonth()}
                onChange={e => setViewMonth(new Date(viewMonth.getFullYear(), Number(e.target.value), 1))}
                className="bg-transparent text-sm font-semibold px-1 rounded outline-none"
                style={{ color: 'var(--text-base)' }}
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const name = new Date(2024, i, 1).toLocaleDateString(locale, { month: 'long' })
                  return <option key={i} value={i}>{name.charAt(0).toUpperCase() + name.slice(1)}</option>
                })}
              </select>
              <select
                value={viewMonth.getFullYear()}
                onChange={e => setViewMonth(new Date(Number(e.target.value), viewMonth.getMonth(), 1))}
                className="bg-transparent text-sm font-semibold px-1 rounded outline-none"
                style={{ color: 'var(--text-base)' }}
              >
                {Array.from({ length: 10 }).map((_, i) => {
                  const y = today.getFullYear() - 5 + i
                  return <option key={y} value={y}>{y}</option>
                })}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekdayShort.map(w => (
              <div key={w} className="text-center text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{w}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} />
              const isFuture = d > today
              const isToday = sameDay(d, today)
              const isFrom  = selFrom && sameDay(d, selFrom)
              const isTo    = selTo && sameDay(d, selTo)
              const isEndpoint = isFrom || isTo
              const isMiddle = inRange(d) && !isEndpoint
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => onDayClick(d)}
                  disabled={isFuture}
                  className="h-9 rounded-lg text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-30"
                  style={{
                    background: isEndpoint ? 'var(--c1)'
                              : isMiddle ? 'rgba(107, 168, 240, 0.15)'
                              : 'transparent',
                    color: isEndpoint ? '#131321'
                         : isToday ? 'var(--c1)'
                         : 'var(--text-base)',
                    border: isToday && !isEndpoint ? '1px solid var(--c1)' : '1px solid transparent',
                  }}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          {/* Footer actions */}
          <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={clear}
              disabled={pending}
              className="text-xs font-medium hover:underline disabled:opacity-40"
              style={{ color: 'var(--text-muted)' }}
            >
              {lang === 'uz' ? 'Tozalash' : lang === 'ru' ? 'Сбросить' : 'Clear'}
            </button>
            <div className="flex-1 text-xs text-right" style={{ color: 'var(--text-muted)' }}>
              {selFrom && !selTo && (lang === 'uz' ? 'Tugash sanasini tanlang…' : lang === 'ru' ? 'Выберите конечную дату…' : 'Pick end date…')}
              {selFrom && selTo && (
                <>
                  {selFrom.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                  {' — '}
                  {selTo.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={apply}
              disabled={!selFrom || pending}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5"
              style={{ background: 'var(--c1)', color: '#131321' }}
            >
              {pending && <Spinner className="w-3 h-3" />}
              {lang === 'uz' ? "Qo'llash" : lang === 'ru' ? 'Применить' : 'Apply'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
