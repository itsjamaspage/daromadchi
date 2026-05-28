'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export const RANGE_OPTIONS = [
  { label: '7 kun',  value: '7'  },
  { label: '30 kun', value: '30' },
  { label: '90 kun', value: '90' },
] as const

export type RangeValue = typeof RANGE_OPTIONS[number]['value']

export function parseDays(searchParams: { get(key: string): string | null }): number {
  const v = searchParams.get('days')
  return v === '7' || v === '90' ? Number(v) : 30
}

interface DateFilterProps {
  current: string
}

export default function DateFilter({ current }: DateFilterProps) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function setRange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('days', value)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  return (
    <div className={`flex items-center gap-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl p-1 transition-opacity ${pending ? 'opacity-60' : ''}`}>
      {RANGE_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => setRange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            current === opt.value
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
