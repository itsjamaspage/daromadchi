import { Suspense } from 'react'
import DashboardClient from './DashboardClient'
import type { MarketplaceSlice, PanelKey } from './DashboardClient'
import { getKpis } from '@/lib/db/kpis'
import { getOrders } from '@/lib/db/orders'
import { getProducts, getProductSales, getCategoryRevenue } from '@/lib/db/products'
import { getDailyRevenue } from '@/lib/db/revenue'
import { getUserShops, getSyncInfo } from '@/lib/db/shop-context'
import { getStockGroups } from '@/lib/db/stock-groups'
import WelcomePopup from '@/components/dashboard/WelcomePopup'
import type { MarketplaceType } from '@/lib/types'
import { startOfIsoWeek, endOfIsoWeek, localDateStr, shopWeekBounds } from '@/lib/period-week'
import { inclusiveDays } from '@/lib/kpi-windows'

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
//
// The fallback value is what the panel renders, so it has to be reported as
// well as returned. A failed getKpis used to fall back to zeroes, and zero
// revenue is a claim: the seller reads "you sold nothing this week" off a panel
// that means "the query threw". Every fallback here now records the panel's
// name in `failed`, and the client shows a placeholder instead of the number.
async function withFallback<T>(
  panel: PanelKey,
  work: Promise<T>,
  fallback: T,
  failed: PanelKey[],
): Promise<T> {
  try {
    return await work
  } catch (e) {
    console.error(`[dashboard] ${panel}`, e)
    failed.push(panel)
    return fallback
  }
}

async function fetchSlice(
  days: number,
  marketplace: MarketplaceType | undefined,
  hasConnectedShop: boolean,
  from?: string,
  to?: string,
): Promise<MarketplaceSlice> {
  const emptyKpis = { total_revenue: 0, total_profit: 0, total_orders: 0, total_stock: 0 }
  const failed: PanelKey[] = []
  const [kpis, recentOrders, allProducts, productSales, chartData, categoryData] = await Promise.all([
    withFallback('kpis',         getKpis(days, marketplace, from, to), emptyKpis, failed),
    withFallback('orders',       getOrders(5, marketplace, from, to), [], failed),
    withFallback('products',     getProducts(marketplace), [], failed),
    withFallback('productSales', getProductSales(days, marketplace, from, to), [], failed),
    withFallback('chart',        getDailyRevenue(days, marketplace, from, to), [], failed),
    withFallback('categories',   getCategoryRevenue(days, marketplace, from, to), [], failed),
  ])
  return {
    kpis,
    recentOrders,
    allProducts,
    productSales,
    chartData,
    categoryData,
    hasConnectedShop,
    failed,
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
    days = Math.max(1, inclusiveDays(from, to))
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
    // The SELLER's week, not the viewer's or the server's — see lib/shop-time.ts.
    const week = shopWeekBounds(now)
    from   = week.from
    to     = week.to
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
