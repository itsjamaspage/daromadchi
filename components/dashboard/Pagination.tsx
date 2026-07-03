'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

interface Props {
  page: number
  totalPages: number
  basePath: string
}

export default function Pagination({ page, totalPages, basePath }: Props) {
  const { lang } = useLang()
  const d = translations[lang].dashboard

  if (totalPages <= 1) return null

  const prevHref = page > 1 ? `${basePath}?page=${page - 1}` : null
  const nextHref = page < totalPages ? `${basePath}?page=${page + 1}` : null

  const btnBase = 'inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border transition-colors'
  const btnActive = `${btnBase} border-[var(--border2)] text-[var(--text-base)] hover:bg-[var(--bg-input)]`
  const btnDisabled = `${btnBase} border-[var(--border)] text-[var(--text-dim)] opacity-40 pointer-events-none`

  return (
    <div className="flex items-center justify-between pt-2">
      {prevHref ? (
        <Link href={prevHref} className={btnActive}>
          <ChevronLeft className="w-4 h-4" />
          {d.prevPage}
        </Link>
      ) : (
        <span className={btnDisabled}>
          <ChevronLeft className="w-4 h-4" />
          {d.prevPage}
        </span>
      )}

      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {d.pageOf} {page} {d.pageOfSep} {totalPages}
      </span>

      {nextHref ? (
        <Link href={nextHref} className={btnActive}>
          {d.nextPage}
          <ChevronRight className="w-4 h-4" />
        </Link>
      ) : (
        <span className={btnDisabled}>
          {d.nextPage}
          <ChevronRight className="w-4 h-4" />
        </span>
      )}
    </div>
  )
}
