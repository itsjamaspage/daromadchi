'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

export default function DateFilter({ current }: { current: string }) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const { lang } = useLang()
  const d = dashT[lang].dashboard

  const options = [
    { value: '1',     label: d.yesterday },
    { value: '7',     label: `7 ${d.daysSuffix}` },
    { value: '30',    label: `30 ${d.daysSuffix}` },
    { value: '90',    label: `90 ${d.daysSuffix}` },
    { value: 'month', label: d.thisMonth },
  ]

  function setRange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('days', value)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  return (
    <div className={`flex items-center gap-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl p-1 transition-opacity ${pending ? 'opacity-60' : ''}`}>
      {options.map(opt => (
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
