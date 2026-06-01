import Link from 'next/link'
import { ArrowLeft, Clock } from 'lucide-react'
import { getArticleBySlug, ARTICLES } from '@/lib/help-content'
import { notFound } from 'next/navigation'

export function generateStaticParams() {
  return ARTICLES.map(a => ({ slug: a.slug }))
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) notFound()

  // Related articles (same category, excluding current)
  const related = ARTICLES.filter(a => a.categorySlug === article.categorySlug && a.slug !== article.slug).slice(0, 2)

  return (
    <div className="max-w-2xl">
      {/* Back */}
      <Link href="/help" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Barcha maqolalar
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
            {article.category}
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="w-3 h-3" /> {article.readTime}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">{article.title}</h1>
        <p className="text-slate-400 text-sm">{article.description}</p>
      </div>

      {/* Thumbnail */}
      <div className={`h-48 rounded-2xl bg-gradient-to-br ${article.gradient} flex items-center justify-center mb-8 relative overflow-hidden`}>
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative text-center">
          <div className="text-5xl mb-2">{article.icon}</div>
          <p className="text-white font-bold">{article.title}</p>
        </div>
      </div>

      {/* Content */}
      <div
        className="prose-custom"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {/* Related */}
      {related.length > 0 && (
        <div className="mt-12 pt-8 border-t border-white/[0.07]">
          <h3 className="text-white font-semibold mb-4">Shuningdek o&apos;qing</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {related.map(a => (
              <Link key={a.slug} href={`/help/${a.slug}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-violet-500/30 transition-all group">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${a.gradient} flex items-center justify-center flex-shrink-0 text-lg`}>
                  {a.icon}
                </div>
                <div>
                  <p className="text-white text-xs font-medium group-hover:text-violet-300 transition-colors">{a.title}</p>
                  <p className="text-slate-500 text-xs">{a.readTime}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
