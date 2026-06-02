'use client'

import Link from 'next/link'
import { useLang } from '@/app/providers'
import type { Article } from '@/lib/help-content'

const T = {
  uz: {
    back: 'Yordam markazi',
    breadcrumb: 'Yordam',
    useful: "Bu maqola foydali bo'ldimi?",
    yes: '👍 Ha, foydali',
    no: "👎 Yo'q",
    related: 'Shu mavzudagi maqolalar',
  },
  ru: {
    back: 'Справочный центр',
    breadcrumb: 'Помощь',
    useful: 'Была ли статья полезной?',
    yes: '👍 Да, полезно',
    no: '👎 Нет',
    related: 'Статьи по теме',
  },
  en: {
    back: 'Help Center',
    breadcrumb: 'Help',
    useful: 'Was this article helpful?',
    yes: '👍 Yes, helpful',
    no: '👎 No',
    related: 'Related articles',
  },
}

interface Props {
  article: Article
  related: Article[]
  categoryTitle: string
  categoryArticles: Article[]
  renderedContent: string
}

export default function HelpArticleContent({
  article, related, categoryTitle, categoryArticles, renderedContent,
}: Props) {
  const { lang } = useLang()
  const t = T[lang] ?? T.uz

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 flex gap-10">
      {/* Sidebar */}
      <aside className="hidden lg:block w-56 flex-shrink-0">
        <div className="sticky top-20">
          <Link href="/help"
            className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--c1)] transition-colors mb-5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t.back}
          </Link>

          {categoryArticles.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                {categoryTitle}
              </p>
              <nav className="space-y-0.5">
                {categoryArticles.map((navItem) => (
                  <Link key={navItem.slug} href={`/help/${navItem.slug}`}
                    className={`block text-xs px-3 py-2 rounded-lg transition-all ${
                      navItem.slug === article.slug
                        ? 'bg-[var(--c1)]/10 text-[var(--c1)] border border-[var(--c1)]/20'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-base)] hover:bg-[var(--bg-card2)]'
                    }`}>
                    {navItem.title}
                  </Link>
                ))}
              </nav>
            </>
          )}
        </div>
      </aside>

      {/* Article */}
      <article className="flex-1 min-w-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-6">
          <Link href="/help" className="hover:text-[var(--c1)] transition-colors">{t.breadcrumb}</Link>
          <span>/</span>
          <Link href="/help" className="hover:text-[var(--c1)] transition-colors">{article.category}</Link>
          <span>/</span>
          <span className="text-[var(--text-dim)] truncate">{article.title}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold mb-3"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}>
          {article.title}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-8 pb-8 border-b border-[var(--border)]">
          {article.summary}
        </p>

        <div className="prose-custom"
          dangerouslySetInnerHTML={{ __html: renderedContent }} />

        {/* Feedback */}
        <div className="mt-12 pt-8 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text-muted)] mb-3">{t.useful}</p>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-lg border border-[var(--border2)] text-xs text-[var(--text-muted)] hover:border-green-500/40 hover:text-green-400 transition-all">
              {t.yes}
            </button>
            <button className="px-4 py-2 rounded-lg border border-[var(--border2)] text-xs text-[var(--text-muted)] hover:border-red-500/40 hover:text-red-400 transition-all">
              {t.no}
            </button>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-10">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4">
              {t.related}
            </p>
            <div className="grid gap-3">
              {related.map((r) => (
                <Link key={r.slug} href={`/help/${r.slug}`}
                  className="flex items-start gap-3 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--c1)]/40 transition-all neon-card">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--c1)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-base)]">{r.title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{r.summary}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  )
}
