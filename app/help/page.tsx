'use client'

import Link from 'next/link'
import { useState } from 'react'
import { getCategoryList } from '@/lib/help-content'

const ICON_MAP: Record<string, string> = {
  '🚀': '🚀', '🔔': '🔔', '🧩': '🧩', '📊': '📊',
  '📦': '📦', '🧮': '🧮', '📈': '📈', '💳': '💳', '⚙️': '⚙️',
}

export default function HelpPage() {
  const categories = getCategoryList()
  const [query, setQuery] = useState('')

  const allArticles = categories.flatMap((c) => c.articles)
  const filtered = query.trim()
    ? allArticles.filter(
        (a) =>
          a.title.toLowerCase().includes(query.toLowerCase()) ||
          a.summary.toLowerCase().includes(query.toLowerCase()),
      )
    : []

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1
          className="text-3xl sm:text-4xl font-extrabold mb-3"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}
        >
          Yordam markazi
        </h1>
        <p className="text-[var(--text-muted)] mb-8 max-w-md mx-auto text-sm">
          Savollaringizga javob toping yoki qo'llanmalardan foydalaning
        </p>

        {/* Search */}
        <div className="relative max-w-lg mx-auto">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Maqola qidirish..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border2)]
              text-[var(--text-base)] placeholder:text-[var(--text-muted)] text-sm
              focus:outline-none focus:border-[var(--c1)] transition-colors"
          />
        </div>
      </div>

      {/* Search results */}
      {query.trim() && (
        <div className="mb-10">
          {filtered.length === 0 ? (
            <p className="text-center text-[var(--text-muted)] py-8">
              "{query}" bo'yicha hech narsa topilmadi
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-muted)] mb-3">{filtered.length} ta natija</p>
              {filtered.map((a) => (
                <Link
                  key={a.slug}
                  href={`/help/${a.slug}`}
                  className="block p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--c1)]/40 transition-all neon-card"
                >
                  <p className="text-xs text-[var(--c1)] mb-1">{a.category}</p>
                  <p className="text-sm font-semibold text-[var(--text-base)]">{a.title}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{a.summary}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Categories */}
      {!query.trim() && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat) => (
            <div
              key={cat.slug}
              className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 neon-card"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--c1)]/10 to-[var(--c2)]/10 border border-[var(--border2)] flex items-center justify-center text-xl">
                  {cat.icon}
                </div>
                <div>
                  <h2
                    className="font-bold text-[var(--text-base)] text-sm"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {cat.title}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">{cat.articles.length} ta maqola</p>
                </div>
              </div>

              <ul className="space-y-1.5">
                {cat.articles.map((a) => (
                  <li key={a.slug}>
                    <Link
                      href={`/help/${a.slug}`}
                      className="flex items-start gap-2 text-xs text-[var(--text-dim)] hover:text-[var(--c1)] transition-colors group"
                    >
                      <svg
                        className="w-3 h-3 mt-0.5 flex-shrink-0 text-[var(--text-muted)] group-hover:text-[var(--c1)] transition-colors"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Bottom CTA */}
      <div className="mt-16 text-center p-8 rounded-2xl bg-[var(--bg-card2)] border border-[var(--border)]">
        <p className="text-[var(--text-muted)] text-sm mb-2">Javob topa olmadingizmi?</p>
        <p className="text-[var(--text-base)] font-semibold mb-4">Bizga to'g'ridan-to'g'ri yozing</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://t.me/daromadchi_support_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-xl bg-[var(--c1)] text-[#020c1a] font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Telegram orqali yozish
          </a>
          <a
            href="mailto:support@daromadchi.uz"
            className="px-5 py-2.5 rounded-xl border border-[var(--border2)] text-[var(--text-base)] text-sm hover:border-[var(--c1)]/40 hover:text-[var(--c1)] transition-all"
          >
            support@daromadchi.uz
          </a>
        </div>
      </div>
    </main>
  )
}
