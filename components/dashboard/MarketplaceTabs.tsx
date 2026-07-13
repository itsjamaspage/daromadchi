'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useLang, useTheme } from '@/app/providers'
import { dashT } from '@/lib/dashT'
import type { MarketplaceType } from '@/lib/types'

const TABS: { mp: MarketplaceType | undefined; labelKey: 'all' | null; fallback: string; color: 'blue' | 'amber' }[] = [
  { mp: undefined,       labelKey: 'all', fallback: 'All',           color: 'blue'  },
  { mp: 'uzum',          labelKey: null,  fallback: 'Uzum',          color: 'blue'  },
  { mp: 'yandex_market', labelKey: null,  fallback: 'Yandex Market', color: 'amber' },
  { mp: 'wildberries',   labelKey: null,  fallback: 'Wildberries',   color: 'blue'  },
]

export default function MarketplaceTabs({ current }: { current: MarketplaceType | undefined }) {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const { lang } = useLang()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const d = dashT[lang].dashboard

  function tabHref(mp: MarketplaceType | undefined) {
    const p = new URLSearchParams(searchParams.toString())
    if (mp) p.set('mp', mp)
    else p.delete('mp')
    p.delete('page')
    const q = p.toString()
    return q ? `${pathname}?${q}` : pathname
  }

  return (
    <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
      {TABS.map(({ mp, labelKey, fallback, color }) => {
        const active = current === mp
        const label = labelKey ? (d as Record<string, string>)[labelKey] ?? fallback : fallback
        return (
          <Link
            key={fallback}
            href={tabHref(mp)}
            scroll={false}
            prefetch={true}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              active
                ? color === 'amber'
                  ? isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-500/15 text-amber-700 border border-amber-500/30'
                  : 'border border-[var(--border)] text-[var(--c1)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-dim)] border border-transparent'
            }`}
            style={active && color !== 'amber' ? { background: 'var(--bg-card2)' } : {}}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
