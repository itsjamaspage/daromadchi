'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'
import type { MarketplaceType } from '@/lib/types'
import { enabledMarketplaces } from '@/lib/feature-flags'

const MP_LABEL: Record<MarketplaceType, string> = { uzum: 'Uzum' }

type Tab = { mp: MarketplaceType | undefined; labelKey: 'all' | null; fallback: string }

// Derived from the enabled-marketplace list rather than hardcoded, so the bar
// matches whatever the app actually integrates with.
const ENABLED = enabledMarketplaces()
const TABS: Tab[] = [
  { mp: undefined, labelKey: 'all', fallback: 'All' },
  ...ENABLED.map((mp): Tab => ({ mp, labelKey: null, fallback: MP_LABEL[mp] ?? mp })),
]

export default function MarketplaceTabs({ current }: { current: MarketplaceType | undefined }) {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const { lang } = useLang()
  const d = dashT[lang].dashboard

  // With a single integrated marketplace an "All / <one store>" bar offers no
  // choice, so it renders nothing rather than two buttons that mean the same.
  if (ENABLED.length < 2) return null

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
      {TABS.map(({ mp, labelKey, fallback }) => {
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
                ? 'border border-[var(--border)] text-[var(--c1)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-dim)] border border-transparent'
            }`}
            style={active ? { background: 'var(--bg-card2)' } : {}}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
