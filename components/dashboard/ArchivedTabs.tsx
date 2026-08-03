'use client'

import Link from 'next/link'
import { useLang } from '@/app/providers'

// Page-level toggle between the active catalogue and the "Архивные" view.
// Archived products are excluded at the QUERY level (so pagination + counts stay
// correct), which is why this is a URL toggle, not one of ProductsTable's
// client-side Все/Остаток tabs. Rendered only when there's something archived
// to show (or you're already viewing it).
export default function ArchivedTabs({
  archived,
  archivedTotal,
  mp,
}: {
  archived: boolean
  archivedTotal: number
  mp?: string
}) {
  const { lang } = useLang()
  if (archivedTotal === 0 && !archived) return null

  const activeLabel = lang === 'ru' ? 'Активные' : lang === 'en' ? 'Active' : 'Faol'
  const archivedLabel = lang === 'ru' ? 'Архивные' : lang === 'en' ? 'Archived' : 'Arxiv'

  const activeHref = mp ? `/dashboard/products?mp=${mp}` : '/dashboard/products'
  const archivedHref = mp ? `/dashboard/products?mp=${mp}&archived=1` : '/dashboard/products?archived=1'

  const pill = (active: boolean) =>
    'inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ' +
    (active ? '' : 'hover:bg-[var(--bg-input)]')

  return (
    <div className="inline-flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
      <Link
        href={activeHref}
        className={pill(!archived)}
        style={!archived ? { background: 'var(--c1)', color: '#fff' } : { color: 'var(--text-muted)' }}
      >
        {activeLabel}
      </Link>
      <Link
        href={archivedHref}
        className={pill(archived)}
        style={archived ? { background: 'var(--c1)', color: '#fff' } : { color: 'var(--text-muted)' }}
      >
        {archivedLabel}
        <span
          className="min-w-4 h-4 px-1 inline-flex items-center justify-center text-[10px] font-bold rounded-full"
          style={archived ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : { background: 'var(--bg-input)', color: 'var(--text-muted)' }}
        >
          {archivedTotal}
        </span>
      </Link>
    </div>
  )
}
