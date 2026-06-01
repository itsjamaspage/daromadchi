import Link from 'next/link'
import { Search } from 'lucide-react'
import { ARTICLES, CATEGORIES } from '@/lib/help-content'

export default function HelpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  // Note: for static rendering just show all articles grouped by category
  const featuredArticles = ARTICLES.slice(0, 3)
  const restByCategory = CATEGORIES.map(cat => ({
    ...cat,
    articles: ARTICLES.filter(a => a.categorySlug === cat.slug),
  })).filter(c => c.articles.length > 0)

  return (
    <div className="space-y-10">
      {/* Header + search */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Yordam markazi</h1>
        <p className="text-slate-400 text-sm mb-6">Maqolalar, qo&apos;llanmalar va Daromadchi bo&apos;yicha ko&apos;rsatmalar</p>
        <div className="relative max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Maqolalar bo'yicha qidiring..."
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 transition-all"
          />
        </div>
      </div>

      {/* Featured / Getting started */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">🚀 Boshlash</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredArticles.map(article => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </section>

      {/* Other categories */}
      {restByCategory.slice(1).map(cat => (
        <section key={cat.slug}>
          <h2 className="text-lg font-semibold text-white mb-4">{cat.icon} {cat.label}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cat.articles.map(article => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function ArticleCard({ article }: { article: typeof ARTICLES[0] }) {
  return (
    <Link href={`/help/${article.slug}`}
      className="group bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-violet-500/30 hover:bg-white/[0.05] transition-all">
      {/* Thumbnail */}
      <div className={`h-36 bg-gradient-to-br ${article.gradient} flex items-center justify-center relative overflow-hidden`}>
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative text-center px-4">
          <div className="text-4xl mb-2">{article.icon}</div>
          <p className="text-white font-bold text-sm leading-tight line-clamp-2">{article.title}</p>
        </div>
      </div>
      {/* Content */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
            {article.type === 'video' ? 'Video' : 'Maqola'}
          </span>
          <span className="text-[10px] text-slate-500">{article.category}</span>
        </div>
        <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{article.description}</p>
        <p className="text-violet-400 text-xs mt-3 group-hover:text-violet-300 transition-colors flex items-center gap-1">
          O&apos;qish → <span className="text-slate-600">{article.readTime}</span>
        </p>
      </div>
    </Link>
  )
}
