import { notFound } from 'next/navigation'
import { getArticle, getRelatedArticles, getAllSlugs, getCategoryList } from '@/lib/help-content'
import type { Metadata } from 'next'
import HelpArticleContent from '../HelpArticleContent'

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) return {}
  return {
    title: `${article.title} — Daromadchi`,
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
    tableRows = []; tableHeader = []; inTable = false
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (!inCode) { inCode = true; codeLines = [] }
      else {
        html.push(`<pre class="prose-code"><code>${codeLines.join('\n').replace(/</g, '&lt;')}</code></pre>`)
        inCode = false; codeLines = []
      }
      continue
    }
    if (inCode) { codeLines.push(line); continue }

    if (line.startsWith('|')) {
      const cols = line.split('|').slice(1, -1).map((c) => c.trim())
      if (line.match(/^[\s|:-]+$/)) continue
      if (!inTable) { inTable = true; tableHeader = cols }
      else tableRows.push(cols)
      continue
    }
    if (inTable) flushTable()

    if (!line.trim()) { html.push('<br/>'); continue }

    if (line.startsWith('## ')) html.push(`<h2>${line.slice(3)}</h2>`)
    else if (line.startsWith('### ')) html.push(`<h3>${line.slice(4)}</h3>`)
    else if (line.startsWith('- ') || line.startsWith('* ')) html.push(`<li>${inlineFormat(line.slice(2))}</li>`)
    else if (/^\d+\. /.test(line)) html.push(`<li class="ordered">${inlineFormat(line.replace(/^\d+\. /, ''))}</li>`)
    else if (line.startsWith('<info>')) html.push(`<div class="info-box">ℹ️ ${line.replace(/<\/?info>/g, '')}</div>`)
    else if (line.startsWith('<warning>')) html.push(`<div class="warning-box">⚠️ ${line.replace(/<\/?warning>/g, '')}</div>`)
    else html.push(`<p>${inlineFormat(line)}</p>`)
  }

  if (inTable) flushTable()

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

  const related = getRelatedArticles(slug)
  const categories = getCategoryList()
  const currentCategory = categories.find((c) => c.slug === article.categorySlug)

  return (
    <HelpArticleContent
      article={article}
      related={related}
      categoryTitle={currentCategory?.title ?? ''}
      categoryArticles={currentCategory?.articles ?? []}
      renderedContent={renderContent(article.content)}
    />
  )
}
