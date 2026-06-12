import { Suspense } from 'react'
import DashboardClient from './DashboardClient'
import { getKpis } from '@/lib/db/kpis'
import { getOrders } from '@/lib/db/orders'
import { getProducts } from '@/lib/db/products'
import { getDailyRevenue } from '@/lib/db/revenue'
import { getUserShops } from '@/lib/db/shop-context'
import WelcomePopup from '@/components/dashboard/WelcomePopup'
import type { MarketplaceType, Product } from '@/lib/types'

function parseDays(params: Record<string, string> | undefined): number {
  const v = params?.days
  return v === '7' || v === '90' ? Number(v) : 30
}

const VALID_MARKETPLACES = ['uzum', 'yandex_market', 'wildberries'] as const

function parseMarketplace(params: Record<string, string> | undefined): MarketplaceType | undefined {
  const v = params?.mp
  return (VALID_MARKETPLACES as readonly string[]).includes(v ?? '') ? v as MarketplaceType : undefined
}

function buildCategoryData(products: Product[]) {
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
  const marketplace = parseMarketplace(params)

  const [kpis, recentOrders, allProducts, chartData, allShops] = await Promise.all([
    getKpis(days, marketplace),
    getOrders(5, marketplace),
    getProducts(marketplace),
    getDailyRevenue(days, marketplace),
    getUserShops(),
  ])
  const hasShops = allShops.length > 0
  const hasConnectedShop = marketplace
    ? allShops.some(s => s.marketplace === marketplace)
    : hasShops

  const categoryData = buildCategoryData(allProducts)

  return (
    <Suspense>
      <WelcomePopup hasShops={hasShops} />
      <DashboardClient
        kpis={kpis}
        recentOrders={recentOrders}
        allProducts={allProducts}
        chartData={chartData}
        categoryData={categoryData}
        days={days}
        period={String(days)}
        marketplace={marketplace}
        hasConnectedShop={hasConnectedShop}
      />
    </Suspense>
  )
}
