'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { CalendarDays } from 'lucide-react'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

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

export default function DateRangePicker({ period, from, to }: Props) {
  const [open, setOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(from ?? '')
  const [customTo, setCustomTo]     = useState(to ?? todayStr())
  const ref = useRef<HTMLDivElement>(null)

  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const { lang } = useLang()
  const d = dashT[lang].dashboard

  const presets = [
    { value: '1',     label: d.yesterday },
    { value: '7',     label: `7 ${d.daysSuffix}` },
    { value: '30',    label: `30 ${d.daysSuffix}` },
    { value: '90',    label: `90 ${d.daysSuffix}` },
    { value: 'month', label: d.thisMonth },
  ]

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function navigate(params: URLSearchParams) {
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
      setOpen(false)
    })
  }

  function applyPreset(value: string) {
    const p = new URLSearchParams(searchParams.toString())
    p.set('days', value)
    p.delete('from')
    p.delete('to')
    navigate(p)
  }

  function applyCustom() {
    if (!customFrom || !customTo) return
    const p = new URLSearchParams(searchParams.toString())
    p.delete('days')
    p.set('from', customFrom)
    p.set('to', customTo)
    navigate(p)
  }

  // Label shown on the button
  const label = from && to
    ? `${formatDateLabel(from)} — ${formatDateLabel(to)}`
    : presets.find(p => p.value === period)?.label ?? `30 ${d.daysSuffix}`

  const isCustom = !!(from && to)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${pending ? 'opacity-60' : ''}`}
        style={{
          background: open ? 'rgba(131,192,249,0.12)' : 'var(--bg-input)',
          borderColor: open ? 'rgba(131,192,249,0.35)' : 'var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--c1)' }} />
        <span style={{ color: 'var(--text-base)' }}>{label}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 rounded-2xl border shadow-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', minWidth: 240 }}
        >
          {/* Presets */}
          <div className="p-2 space-y-0.5">
            {presets.map(p => {
              const active = !isCustom && period === p.value
              return (
                <button
                  key={p.value}
                  onClick={() => applyPreset(p.value)}
                  className="w-full text-left px-3 py-2 rounded-xl text-sm transition-all"
                  style={active ? {
                    background: 'rgba(131,192,249,0.15)',
                    color: 'var(--c1)',
                    border: '1px solid rgba(131,192,249,0.3)',
                  } : {
                    color: 'var(--text-muted)',
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-base)' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* Custom range */}
          <div className="px-3 pb-3 pt-1 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>
              {lang === 'uz' ? 'Maxsus davr' : lang === 'ru' ? 'Произвольный период' : 'Custom range'}
            </p>
            <div className="flex flex-col gap-1.5">
              <input
                type="date"
                value={customFrom}
                max={customTo || todayStr()}
                onChange={e => setCustomFrom(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs border outline-none"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-base)',
                  colorScheme: 'var(--color-scheme, light)',
                }}
              />
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayStr()}
                onChange={e => setCustomTo(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs border outline-none"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-base)',
                  colorScheme: 'var(--color-scheme, light)',
                }}
              />
            </div>
            <button
              onClick={applyCustom}
              disabled={!customFrom || !customTo}
              className="w-full py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
              style={{ background: '#83c0f9', color: '#131321' }}
            >
              {lang === 'uz' ? 'Qo\'llash' : lang === 'ru' ? 'Применить' : 'Apply'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
