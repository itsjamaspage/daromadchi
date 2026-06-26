import { Suspense } from 'react'
import DashboardClient from './DashboardClient'
import type { MarketplaceSlice } from './DashboardClient'
import { getKpis } from '@/lib/db/kpis'
import { getOrders } from '@/lib/db/orders'
import { getProducts } from '@/lib/db/products'
import type { CategoryRow } from '@/lib/db/products'
import { getDailyRevenue } from '@/lib/db/revenue'
import { getUserShops } from '@/lib/db/shop-context'
import WelcomePopup from '@/components/dashboard/WelcomePopup'
import type { MarketplaceType } from '@/lib/types'

function parseDays(v: string | undefined): number {
  if (v === '1')     return 1
  if (v === '7')     return 7
  if (v === '30')    return 30
  if (v === '90')    return 90
  if (v === '365')   return 365
  if (v === 'month') return new Date().getDate() // days elapsed since 1st of current month
  return 365
}

const VALID_MARKETPLACES = ['uzum', 'yandex_market', 'wildberries'] as const

function parseMarketplace(params: Record<string, string> | undefined): MarketplaceType | undefined {
  const v = params?.mp
  return (VALID_MARKETPLACES as readonly string[]).includes(v ?? '') ? v as MarketplaceType : undefined
}

function buildCategoryData(products: Awaited<ReturnType<typeof getProducts>>): CategoryRow[] {
  const map = new Map<string, { revenue: number; profit: number }>()
  for (const p of products) {
    const cat = p.category ?? 'Boshqa'
    const rev = Number(p.selling_price ?? 0)
    const prof = Number(p.profit ?? 0)
    const existing = map.get(cat) ?? { revenue: 0, profit: 0 }
    map.set(cat, { revenue: existing.revenue + rev, profit: existing.profit + prof })
  }
  const total = [...map.values()].reduce((s, v) => s + v.revenue, 0)
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v, percent: total > 0 ? (v.revenue / total) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
}

async function fetchSlice(
  days: number,
  marketplace: MarketplaceType | undefined,
  hasConnectedShop: boolean,
  from?: string,
  to?: string,
): Promise<MarketplaceSlice> {
  const [kpis, recentOrders, allProducts, chartData] = await Promise.all([
    getKpis(days, marketplace, from, to),
    getOrders(5, marketplace),
    getProducts(marketplace),
    getDailyRevenue(days, marketplace, from, to),
  ])
  return {
    kpis,
    recentOrders,
    allProducts,
    chartData,
    categoryData: buildCategoryData(allProducts),
    hasConnectedShop,
  }
}

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function DashboardPage({ searchParams }: Props) {
  const params             = await searchParams
  const period             = params?.days ?? '365'
  const days               = parseDays(period)
  const from               = params?.from
  const to                 = params?.to
  const initialMarketplace = parseMarketplace(params)

  const allShops   = await getUserShops()
  const hasShops   = allShops.length > 0
  const hasUzum    = allShops.some(s => s.marketplace === 'uzum')
  const hasYM      = allShops.some(s => s.marketplace === 'yandex_market')
  const hasWB      = allShops.some(s => s.marketplace === 'wildberries')

  const [allSlice, uzumSlice, ymSlice, wbSlice] = await Promise.all([
    fetchSlice(days, undefined,       hasShops,  from, to),
    fetchSlice(days, 'uzum',          hasUzum,   from, to),
    fetchSlice(days, 'yandex_market', hasYM,     from, to),
    fetchSlice(days, 'wildberries',   hasWB,     from, to),
  ])

  return (
    <Suspense>
      <WelcomePopup hasShops={hasShops} />
      <DashboardClient
        slices={{ all: allSlice, uzum: uzumSlice, yandex_market: ymSlice, wildberries: wbSlice }}
        days={days}
        period={period}
        from={from}
        to={to}
        initialMarketplace={initialMarketplace}
        hasShops={hasShops}
      />
    </Suspense>
  )
}
