'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

interface Props {
  page: number
  totalPages: number
  basePath: string
}

export default function Pagination({ page, totalPages, basePath }: Props) {
  const searchParams = useSearchParams()
  const { lang } = useLang()
  const d = dashT[lang].dashboard

  if (totalPages <= 1) return null

  function pageHref(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (p > 1) params.set('page', String(p))
    else params.delete('page')
    const q = params.toString()
    return q ? `${basePath}?${q}` : basePath
  }

  const linkClass = 'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border'
  const disabledClass = 'border-transparent text-[var(--text-muted)] opacity-40 pointer-events-none'
  const enabledClass = 'border-[var(--border2)] text-[var(--text-muted)] hover:text-[var(--text-base)] bg-[var(--bg-card2)]'

  return (
    <div className="flex items-center justify-center gap-3">
      <Link
        href={pageHref(page - 1)}
        className={`${linkClass} ${page <= 1 ? disabledClass : enabledClass}`}
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : 0}
        scroll={false}
      >
        {(d as Record<string, string>).prevPage ?? 'Previous'}
      </Link>
      <span className="text-xs font-medium text-[var(--text-muted)]">
        {(d as Record<string, string>).pageOf ?? 'Page'} {page} {(d as Record<string, string>).pageOfSep ?? 'of'} {totalPages}
      </span>
      <Link
        href={pageHref(page + 1)}
        className={`${linkClass} ${page >= totalPages ? disabledClass : enabledClass}`}
        aria-disabled={page >= totalPages}
        tabIndex={page >= totalPages ? -1 : 0}
        scroll={false}
      >
        {(d as Record<string, string>).nextPage ?? 'Next'}
      </Link>
    </div>
  )
}
