import { Suspense } from 'react'
import DashboardClient from './DashboardClient'
import type { MarketplaceSlice } from './DashboardClient'
import { getKpis } from '@/lib/db/kpis'
import { getOrders } from '@/lib/db/orders'
import { getProducts, getProductSales, getCategoryRevenue } from '@/lib/db/products'
import { getDailyRevenue } from '@/lib/db/revenue'
import { getUserShops, getShopLaunchDate } from '@/lib/db/shop-context'
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

async function fetchSlice(
  days: number,
  marketplace: MarketplaceType | undefined,
  hasConnectedShop: boolean,
  from?: string,
  to?: string,
): Promise<MarketplaceSlice> {
  const [kpis, recentOrders, allProducts, productSales, chartData, categoryData] = await Promise.all([
    getKpis(days, marketplace, from, to),
    getOrders(5, marketplace, from, to),
    getProducts(marketplace),
    getProductSales(days, marketplace, from, to),
    getDailyRevenue(days, marketplace, from, to),
    marketplace ? Promise.resolve([]) : getCategoryRevenue(days, undefined, from, to),
  ])
  return {
    kpis,
    recentOrders,
    allProducts,
    productSales,
    chartData,
    categoryData,
    hasConnectedShop,
  }
}

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function DashboardPage({ searchParams }: Props) {
  const params             = await searchParams
  const period             = params?.days ?? '365'
  let   days               = parseDays(period)
  let   from               = params?.from
  let   to                 = params?.to
  const initialMarketplace = parseMarketplace(params)

  // Default view: use the earliest order date as "from" so users always see all their data
  if (!from && !to && period === '365') {
    const launchDate = await getShopLaunchDate()
    if (launchDate) {
      from = launchDate.slice(0, 10)
      to   = new Date().toISOString().slice(0, 10)
      // eslint-disable-next-line react-hooks/purity
      days = Math.ceil((Date.now() - new Date(from).getTime()) / 86_400_000)
    }
  }

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
