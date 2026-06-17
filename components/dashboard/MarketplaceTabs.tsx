'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { MarketplaceType } from '@/lib/types'

const TABS = [
  { mp: undefined,       label: 'Barchasi'      },
  { mp: 'uzum',          label: 'Uzum'          },
  { mp: 'yandex_market', label: 'Yandex Market' },
  { mp: 'wildberries',   label: 'Wildberries'   },
] as { mp: MarketplaceType | undefined; label: string }[]

export default function MarketplaceTabs({ current }: { current: MarketplaceType | undefined }) {
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  function tabHref(mp: MarketplaceType | undefined) {
    const p = new URLSearchParams(searchParams.toString())
    if (mp) p.set('mp', mp)
    else p.delete('mp')
    const q = p.toString()
    return q ? `${pathname}?${q}` : pathname
  }

  return (
    <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
      {TABS.map(({ mp, label }) => (
        <Link
          key={label}
          href={tabHref(mp)}
          scroll={false}
          prefetch={true}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            current === mp
              ? 'bg-violet-600/20 text-[var(--c1)] border border-violet-500/30'
              : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  )
}
