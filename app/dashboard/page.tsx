import { Suspense } from 'react'
import DashboardClient from './DashboardClient'
import type { MarketplaceSlice } from './DashboardClient'
import { getKpis } from '@/lib/db/kpis'
import { getOrders } from '@/lib/db/orders'
import { getProducts, getProductSales, getCategoryRevenue } from '@/lib/db/products'
import { getDailyRevenue } from '@/lib/db/revenue'
import { getUserShops, getSyncInfo } from '@/lib/db/shop-context'
import { getStockGroups } from '@/lib/db/stock-groups'
import WelcomePopup from '@/components/dashboard/WelcomePopup'
import type { MarketplaceType } from '@/lib/types'
import { startOfIsoWeek, endOfIsoWeek, localDateStr } from '@/lib/period-week'

function parseDays(v: string | undefined): number {
  if (v === '1')     return 1
  if (v === '7')     return 7
  if (v === '30')    return 30
  if (v === '90')    return 90
  if (v === '365')   return 365
  if (v === 'month') return new Date().getDate() // days elapsed since 1st of current month
  return 365
}

const VALID_MARKETPLACES = ['uzum', 'yandex_market'] as const

function parseMarketplace(params: Record<string, string> | undefined): MarketplaceType | undefined {
  const v = params?.mp
  return (VALID_MARKETPLACES as readonly string[]).includes(v ?? '') ? v as MarketplaceType : undefined
}

// Each fetch is wrapped so one failing query (e.g. a missing table on an
// out-of-date DB) degrades that panel rather than 500ing the whole dashboard.
async function fetchSlice(
  days: number,
  marketplace: MarketplaceType | undefined,
  hasConnectedShop: boolean,
  from?: string,
  to?: string,
): Promise<MarketplaceSlice> {
  const emptyKpis = { total_revenue: 0, total_profit: 0, total_orders: 0, total_stock: 0 }
  const [kpis, recentOrders, allProducts, productSales, chartData, categoryData] = await Promise.all([
    getKpis(days, marketplace, from, to).catch(e => { console.error('[dashboard] getKpis', e); return emptyKpis }),
    getOrders(5, marketplace, from, to).catch(e => { console.error('[dashboard] getOrders', e); return [] }),
    getProducts(marketplace).catch(e => { console.error('[dashboard] getProducts', e); return [] }),
    getProductSales(days, marketplace, from, to).catch(e => { console.error('[dashboard] getProductSales', e); return [] }),
    getDailyRevenue(days, marketplace, from, to).catch(e => { console.error('[dashboard] getDailyRevenue', e); return [] }),
    getCategoryRevenue(days, marketplace, from, to).catch(e => { console.error('[dashboard] getCategoryRevenue', e); return [] }),
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
  const explicitDays       = params?.days
  let   from               = params?.from
  let   to                 = params?.to
  let   period: string
  let   days: number
  const initialMarketplace = parseMarketplace(params)

  if (from && to) {
    // Custom range chosen in the picker — honour it verbatim.
    period = ''
    days = Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1)
  } else if (explicitDays) {
    // Explicit preset (?days=…), e.g. the "1 year" chip.
    period = explicitDays
    days = parseDays(explicitDays)
  } else {
    // DEFAULT: the CURRENT WEEK (Mon–Sun), matching the P&L page. The ‹ / ›
    // buttons page a week at a time, so the dashboard opens on "this week"
    // rather than a year-long span. Revenue is delivered-basis (see kpis.ts),
    // so the week fills in as orders are delivered.
    // Week maths lives in lib/period-week.ts — one Monday-based definition the
    // P&L, Заработок and this page all share. Hand-rolled copies drifted apart:
    // this one ended with toISOString(), which converts to UTC and can name the
    // wrong Monday for anyone not on UTC. localDateStr keeps it local.
    const now = new Date()
    from   = localDateStr(startOfIsoWeek(now))
    to     = localDateStr(endOfIsoWeek(now))
    period = ''
    days   = 7
  }

  const allShops   = await getUserShops().catch(e => { console.error('[dashboard] getUserShops', e); return [] })
  const hasShops   = allShops.length > 0
  const hasUzum    = allShops.some(s => s.marketplace === 'uzum')
  const hasYM      = allShops.some(s => s.marketplace === 'yandex_market')

  const [allSlice, uzumSlice, ymSlice, stockGroups, syncInfo] = await Promise.all([
    fetchSlice(days, undefined,       hasShops,  from, to),
    fetchSlice(days, 'uzum',          hasUzum,   from, to),
    fetchSlice(days, 'yandex_market', hasYM,     from, to),
    // Cross-marketplace grouped stock — same SKU on Uzum + YM collapses
    // to one alert with marketplace badges instead of N duplicates.
    getStockGroups().catch(e => { console.error('[dashboard] getStockGroups', e); return [] }),
    getSyncInfo().catch(e => { console.error('[dashboard] getSyncInfo', e); return { lastSyncedAt: null, lastSyncFailed: false, alerts: [] } }),
  ])

  return (
    <Suspense>
      <WelcomePopup hasShops={hasShops} />
      <DashboardClient
        slices={{ all: allSlice, uzum: uzumSlice, yandex_market: ymSlice }}
        stockGroups={stockGroups}
        days={days}
        period={period}
        from={from}
        to={to}
        initialMarketplace={initialMarketplace}
        hasShops={hasShops}
        syncInfo={syncInfo}
      />
    </Suspense>
  )
}
