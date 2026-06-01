import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getArticle, getRelatedArticles, getAllSlugs, getCategoryList } from '@/lib/help-content'
import type { Metadata } from 'next'

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) return {}
  return {
    title: `${article.title} — Daromadchi Yordam`,
    description: article.summary,
  }
}

function renderContent(raw: string) {
  const lines = raw.trim().split('\n')
  const html: string[] = []
  let inTable = false
  let tableRows: string[][] = []
  let tableHeader: string[] = []
  let inCode = false
  let codeLines: string[] = []

  function flushTable() {
    if (!tableRows.length) return
    let t = '<table class="prose-table">'
    if (tableHeader.length) {
      t += '<thead><tr>' + tableHeader.map((h) => `<th>${h}</th>`).join('') + '</tr></thead>'
    }
    t += '<tbody>' + tableRows.map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table>'
    html.push(t)
    tableRows = []
    tableHeader = []
    inTable = false
  }

  for (const raw of lines) {
    const line = raw

    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true
        codeLines = []
      } else {
        html.push(`<pre class="prose-code"><code>${codeLines.join('\n').replace(/</g, '&lt;')}</code></pre>`)
        inCode = false
        codeLines = []
      }
      continue
    }
    if (inCode) { codeLines.push(line); continue }

    // tables
    if (line.startsWith('|')) {
      const cols = line.split('|').slice(1, -1).map((c) => c.trim())
      if (line.match(/^[\s|:-]+$/)) { continue } // separator row
      if (!inTable) {
        inTable = true
        tableHeader = cols
      } else {
        tableRows.push(cols)
      }
      continue
    }
    if (inTable) flushTable()

    if (!line.trim()) { html.push('<br/>'); continue }

    if (line.startsWith('## ')) {
      html.push(`<h2>${line.slice(3)}</h2>`)
    } else if (line.startsWith('### ')) {
      html.push(`<h3>${line.slice(4)}</h3>`)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      html.push(`<li>${inlineFormat(line.slice(2))}</li>`)
    } else if (/^\d+\. /.test(line)) {
      html.push(`<li class="ordered">${inlineFormat(line.replace(/^\d+\. /, ''))}</li>`)
    } else if (line.startsWith('<info>')) {
      const text = line.replace('<info>', '').replace('</info>', '')
      html.push(`<div class="info-box">ℹ️ ${text}</div>`)
    } else if (line.startsWith('<warning>')) {
      const text = line.replace('<warning>', '').replace('</warning>', '')
      html.push(`<div class="warning-box">⚠️ ${text}</div>`)
    } else {
      html.push(`<p>${inlineFormat(line)}</p>`)
    }
  }

  if (inTable) flushTable()

  // wrap consecutive <li> into <ul> or <ol>
  const joined = html.join('\n')
  const withOl = joined.replace(/(<li class="ordered">[\s\S]*?<\/li>\n?)+/g, (m) => `<ol>${m.replace(/ class="ordered"/g, '')}</ol>`)
  return withOl.replace(/(<li>(?![\s\S]*class)[\s\S]*?<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
}

function inlineFormat(s: string) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="prose-link">$1</a>')
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) notFound()
  const a = article!

  const related = getRelatedArticles(slug)
  const categories = getCategoryList()
  const currentCategory = categories.find((c) => c.slug === a.categorySlug)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 flex gap-10">
      {/* Sidebar */}
      <aside className="hidden lg:block w-56 flex-shrink-0">
        <div className="sticky top-20">
          <Link
            href="/help"
            className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--c1)] transition-colors mb-5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Yordam markazi
          </Link>

          {currentCategory && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                {currentCategory.title}
              </p>
              <nav className="space-y-0.5">
                {currentCategory.articles.map((navItem) => (
                  <Link
                    key={navItem.slug}
                    href={`/help/${navItem.slug}`}
                    className={`block text-xs px-3 py-2 rounded-lg transition-all ${
                      navItem.slug === slug
                        ? 'bg-[var(--c1)]/10 text-[var(--c1)] border border-[var(--c1)]/20'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-base)] hover:bg-[var(--bg-card2)]'
                    }`}
                  >
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
          <Link href="/help" className="hover:text-[var(--c1)] transition-colors">Yordam</Link>
          <span>/</span>
          <Link href="/help" className="hover:text-[var(--c1)] transition-colors">{a.category}</Link>
          <span>/</span>
          <span className="text-[var(--text-dim)] truncate">{a.title}</span>
        </div>

        <h1
          className="text-2xl sm:text-3xl font-extrabold mb-3"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}
        >
          {a.title}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-8 pb-8 border-b border-[var(--border)]">
          {a.summary}
        </p>

        <div
          className="prose-custom"
          dangerouslySetInnerHTML={{ __html: renderContent(a.content) }}
          style={{
            ['--prose-h3-color' as string]: 'var(--text-base)',
          }}
        />

        {/* Feedback */}
        <div className="mt-12 pt-8 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text-muted)] mb-3">Bu maqola foydali bo'ldimi?</p>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-lg border border-[var(--border2)] text-xs text-[var(--text-muted)] hover:border-green-500/40 hover:text-green-400 transition-all">
              👍 Ha, foydali
            </button>
            <button className="px-4 py-2 rounded-lg border border-[var(--border2)] text-xs text-[var(--text-muted)] hover:border-red-500/40 hover:text-red-400 transition-all">
              👎 Yo'q
            </button>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-10">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4">
              Shu mavzudagi maqolalar
            </p>
            <div className="grid gap-3">
              {related.map((a) => (
                <Link
                  key={a.slug}
                  href={`/help/${a.slug}`}
                  className="flex items-start gap-3 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--c1)]/40 transition-all neon-card"
                >
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--c1)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-base)]">{a.title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{a.summary}</p>
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
