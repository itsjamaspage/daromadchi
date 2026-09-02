'use client'

import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { ALL_CAT, catKeyLabel } from '@/lib/filters/category-helpers'
import type { Lang } from '@/lib/i18n'

interface FilterBarProps {
  query: string
  onQueryChange: (q: string) => void
  searchPlaceholder: string
  categories?: string[]
  selectedCategory?: string
  onCategoryChange?: (cat: string) => void
  allCategoryLabel?: string
  lang: Lang
  actions?: ReactNode
  resultCount?: number
  countLabel?: string
}

export default function FilterBar({
  query, onQueryChange, searchPlaceholder,
  categories, selectedCategory, onCategoryChange, allCategoryLabel,
  lang, actions, resultCount, countLabel,
}: FilterBarProps) {
  const isFiltered = query.trim() || (selectedCategory && selectedCategory !== ALL_CAT)
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative w-full sm:w-64 sm:shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none transition-all"
            style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: 'var(--text-base)', border: '1px solid var(--border)' }}
          />
        </div>
        {categories && onCategoryChange && (
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {categories.map(c => (
              <button key={c} onClick={() => onCategoryChange(c)}
                className="px-3 py-2 rounded-xl text-xs font-medium transition-all border"
                style={selectedCategory === c ? {
                  background: 'var(--bg-card2)',
                  color: 'var(--c1)',
                  borderColor: 'var(--border)',
                } : {
                  color: 'var(--text-muted)',
                  borderColor: 'var(--border)',
                }}>
                {c === ALL_CAT ? (allCategoryLabel ?? 'All') : catKeyLabel(c, lang)}
              </button>
            ))}
          </div>
        )}
        {actions && <div className="sm:ml-auto shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
      {resultCount != null && countLabel && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {resultCount} {countLabel} {isFiltered ? '(filtr)' : ''}
        </p>
      )}
    </div>
  )
}
