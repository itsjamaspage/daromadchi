import { Package, Settings } from 'lucide-react'
import Link from 'next/link'
import { getProducts } from '@/lib/db/products'
import { getAdsStats } from '@/lib/db/ads'
import ProductsTable from '@/components/dashboard/ProductsTable'
import { getLang } from '@/lib/lang'
import { dashT } from '@/lib/dashT'

export default async function ProductsPage() {
  const [products, adsStats] = await Promise.all([
    getProducts(),
    getAdsStats(30),
  ])
  const lang = await getLang()
  const t = dashT[lang].products

  // Convert Map to plain object for serialization across server→client boundary
  const adsStatsObj: Record<string, import('@/lib/types').AdsStatsSummary> = {}
  for (const [sku, stats] of adsStats) {
    adsStatsObj[sku] = stats
  }
  const hasAds = Object.keys(adsStatsObj).length > 0

  if (products.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-slate-400 text-sm mt-1">0 {t.count}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-dashed border-violet-500/30 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7 text-violet-400" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">{t.empty}</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">{t.emptyDesc}</p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
            <Settings className="w-4 h-4" /> {t.goSettings}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.title}</h1>
        <p className="text-slate-400 text-sm mt-1">{products.length} {t.count}</p>
      </div>
      <ProductsTable products={products} adsStats={hasAds ? adsStatsObj : undefined} />
    </div>
  )
}
