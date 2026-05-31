import { getKpis } from '@/lib/db/kpis'
import { getOrders } from '@/lib/db/orders'
import { getProducts } from '@/lib/db/products'
import { getDailyRevenue } from '@/lib/db/revenue'
import DashboardClient from './DashboardClient'
import type { MarketplaceType } from '@/lib/types'

const VALID_MARKETPLACES = ['uzum', 'yandex_market', 'wildberries'] as const
const VALID_PERIODS = ['1', '7', '30', '90', 'month'] as const
type Period = typeof VALID_PERIODS[number]

function parsePeriod(params: Record<string, string> | undefined): Period {
  const v = params?.days ?? '30'
  return (VALID_PERIODS as readonly string[]).includes(v) ? v as Period : '30'
}

function periodToDays(period: Period): number {
  if (period === '1')     return 1
  if (period === '7')     return 7
  if (period === '90')    return 90
  if (period === 'month') return new Date().getDate()
  return 30
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
  const period      = parsePeriod(params)
  const days        = periodToDays(period)
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
      period={period}
      marketplace={marketplace}
    />
  )
}
