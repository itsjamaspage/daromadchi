'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

interface Labels {
  label: string
  p30: string; p90: string; p180: string; p365: string; p730: string; pAll: string
}

const PERIODS = [
  { value: '30',  labelKey: 'p30'  },
  { value: '90',  labelKey: 'p90'  },
  { value: '180', labelKey: 'p180' },
  { value: '365', labelKey: 'p365' },
  { value: '730', labelKey: 'p730' },
  { value: 'all', labelKey: 'pAll' },
] as const

export default function PeriodSelector({ current, labels }: { current: number | null; labels: Labels }) {
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  function href(val: string) {
    const p = new URLSearchParams(searchParams.toString())
    p.set('days', val)
    return `${pathname}?${p.toString()}`
  }

  const currentStr = current === null ? 'all' : String(current)

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{labels.label}:</span>
      <div className="flex items-center gap-1 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl">
        {PERIODS.map(({ value, labelKey }) => (
          <Link
            key={value}
            href={href(value)}
            scroll={false}
            prefetch={true}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              currentStr === value
                ? 'bg-violet-600/20 text-[var(--c1)] border border-violet-500/30'
                : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
            }`}
          >
            {labels[labelKey]}
          </Link>
        ))}
      </div>
    </div>
  )
}
