import { getProducts } from '@/lib/db/products'
import { getLang } from '@/lib/lang'
import { dashT } from '@/lib/dashT'
import AbcXyzClient from './AbcXyzClient'
import Link from 'next/link'
import { Settings } from 'lucide-react'

export default async function AbcXyzPage() {
  const lang = await getLang()
  const t = dashT[lang].abcxyz

  const products = await getProducts()

  if (products.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <h1 className="text-2xl font-bold text-white">{t.title}</h1>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-400">
              {t.badge}
            </span>
          </div>
          <p className="text-slate-400 text-sm">{t.subtitle}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-dashed border-violet-500/30 rounded-2xl p-10 text-center">
          <p className="text-white font-bold text-lg mb-2">{t.noData}</p>
          <p className="text-slate-400 text-sm mb-6">{t.noDataDesc}</p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
            <Settings className="w-4 h-4" /> {t.goSettings}
          </Link>
        </div>
      </div>
    )
  }

  // ABC classification by revenue contribution
  const withRevenue = products
    .map(p => ({ ...p, revenue: (p.selling_price ?? 0) * (p.sold ?? 0) }))
    .sort((a, b) => b.revenue - a.revenue)

  const totalRevenue = withRevenue.reduce((sum, p) => sum + p.revenue, 0)
  let cumulative = 0

  const classified = withRevenue.map(p => {
    cumulative += p.revenue
    const share = totalRevenue > 0 ? cumulative / totalRevenue : 1
    const abc = share <= 0.80 ? 'A' : share <= 0.95 ? 'B' : 'C'
    const sold = p.sold ?? 0
    const xyz = sold >= 10 ? 'X' : sold > 0 ? 'Y' : 'Z'
    return {
      id: p.id,
      title: p.title,
      sku: p.sku,
      revenue: p.revenue,
      revenueShare: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0,
      sold,
      abc,
      xyz,
      combined: abc + xyz,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-0.5">
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-400">
            {t.badge}
          </span>
        </div>
        <p className="text-slate-400 text-sm">{t.subtitle}</p>
      </div>
      <AbcXyzClient products={classified} />
    </div>
  )
}
