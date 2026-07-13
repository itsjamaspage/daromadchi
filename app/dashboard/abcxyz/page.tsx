import { getProducts } from '@/lib/db/products'
import { getDemandVariability } from '@/lib/db/demand'
import { getLang } from '@/lib/lang'
import { dashT } from '@/lib/dashT'
import AbcXyzClient from './AbcXyzClient'
import Link from 'next/link'
import { Settings } from 'lucide-react'

export default async function AbcXyzPage() {
  const lang = await getLang()
  const t = dashT[lang].abcxyz

  const [products, variability] = await Promise.all([
    getProducts(),
    getDemandVariability(),
  ])

  if (products.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <h1 className="text-2xl font-bold text-[var(--text-base)]">{t.title}</h1>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full border text-[var(--c1)]" style={{ background: 'var(--bg-card2)',  borderColor: 'var(--border)' }}>
              {t.badge}
            </span>
          </div>
          <p className="text-[var(--text-muted)] text-sm">{t.subtitle}</p>
        </div>
        <div className="bg-[var(--bg-card2)] border border-dashed border-[var(--border)] rounded-2xl p-10 text-center">
          <p className="text-[var(--text-base)] font-bold text-lg mb-2">{t.noData}</p>
          <p className="text-[var(--text-muted)] text-sm mb-6">{t.noDataDesc}</p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 btn-primary text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
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

  const cumulativeRevs = withRevenue.reduce<number[]>((acc, p) => {
    acc.push((acc[acc.length - 1] ?? 0) + p.revenue)
    return acc
  }, [])

  const classified = withRevenue.map((p, i) => {
    const cumulative = cumulativeRevs[i]
    const share = totalRevenue > 0 ? cumulative / totalRevenue : 1
    const abc = share <= 0.80 ? 'A' : share <= 0.95 ? 'B' : 'C'
    const sold = p.sold ?? 0
    // XYZ by demand stability: coefficient of variation of monthly unit sales.
    // X = steady (CV ≤ 10%), Y = variable (≤ 25%), Z = erratic / no history.
    const v = variability.get(p.id)
    const xyz = !v || v.totalUnits === 0 ? 'Z' : v.cv <= 0.10 ? 'X' : v.cv <= 0.25 ? 'Y' : 'Z'
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
          <h1 className="text-2xl font-bold text-[var(--text-base)]">{t.title}</h1>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full border text-[var(--c1)]" style={{ background: 'var(--bg-card2)',  borderColor: 'var(--border)' }}>
            {t.badge}
          </span>
        </div>
        <p className="text-[var(--text-muted)] text-sm">{t.subtitle}</p>
      </div>
      <AbcXyzClient products={classified} />
    </div>
  )
}
