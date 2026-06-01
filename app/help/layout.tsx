import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import { CATEGORIES, ARTICLES } from '@/lib/help-content'

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const categoryCounts = CATEGORIES.map(cat => ({
    ...cat,
    count: ARTICLES.filter(a => a.categorySlug === cat.slug).length,
  }))

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      {/* Top navbar */}
      <header className="border-b border-white/[0.07] sticky top-0 z-40 bg-[#0a0a12]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">Daromadchi</span>
            <span className="text-slate-500 text-sm">/</span>
            <span className="text-slate-400 text-sm">Yordam markazi</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white transition-colors">
              Dashboard →
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 hidden md:block">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/60 px-3 mb-2">
            Navigatsiya
          </p>
          <nav className="space-y-0.5">
            <Link href="/help"
              className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
              <span className="flex items-center gap-2">📚 Barcha maqolalar</span>
              <span className="text-xs text-slate-600">{ARTICLES.length}</span>
            </Link>
            {categoryCounts.map(cat => (
              <Link key={cat.slug} href={`/help?cat=${cat.slug}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
                <span className="flex items-center gap-2">{cat.icon} {cat.label}</span>
                <span className="text-xs text-slate-600">{cat.count}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-8 px-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">Aloqa</p>
            <a href="https://t.me/daromadchi_support" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-violet-400 transition-colors">
              ✈️ Telegram
            </a>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
