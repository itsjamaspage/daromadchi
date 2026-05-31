import { getKpis } from '@/lib/db/kpis'
import { getOrders } from '@/lib/db/orders'
import { getProducts } from '@/lib/db/products'
import { getDailyRevenue } from '@/lib/db/revenue'
import DashboardClient from './DashboardClient'
import type { MarketplaceType } from '@/lib/types'

const VALID_MARKETPLACES = ['uzum', 'yandex_market'] as const

function parseDays(params: Record<string, string> | undefined): number {
  const v = params?.days
  return v === '7' || v === '90' ? Number(v) : 30
}

function parseMarketplace(params: Record<string, string> | undefined): MarketplaceType | undefined {
  const v = params?.mp
  return (VALID_MARKETPLACES as readonly string[]).includes(v ?? '') ? v as MarketplaceType : undefined
}

function buildCategoryData(products: Awaited<ReturnType<typeof getProducts>>) {
  const map: Record<string, { revenue: number; profit: number }> = {}
  for (const p of products) {
    const cat = p.category ?? 'Boshqa'
    const rev = Number(p.selling_price ?? 0) * (p.sold ?? 0)
    const pro = p.profit * (p.sold ?? 0)
    if (!map[cat]) map[cat] = { revenue: 0, profit: 0 }
    map[cat].revenue += rev
    map[cat].profit  += pro
  }
  const total = Object.values(map).reduce((s, v) => s + v.revenue, 0)
  return Object.entries(map)
    .map(([name, v]) => ({ name, ...v, percent: total > 0 ? (v.revenue / total) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
}

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function DashboardPage({ searchParams }: Props) {
  const params      = await searchParams
  const days        = parseDays(params)
  const daysStr     = String(days)
  const marketplace = parseMarketplace(params)

  const [kpis, recentOrders, allProducts, chartData] = await Promise.all([
    getKpis(days, marketplace),
    getOrders(5, marketplace),
    getProducts(marketplace),
    getDailyRevenue(days, marketplace),
  ])

  return (
    <DashboardClient
      kpis={kpis}
      recentOrders={recentOrders}
      allProducts={allProducts}
      chartData={chartData}
      categoryData={buildCategoryData(allProducts)}
      days={days}
      daysStr={daysStr}
      marketplace={marketplace}
    />
  )
}
