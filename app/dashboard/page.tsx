import { Suspense } from 'react'
import DashboardClient from './DashboardClient'
import type { MarketplaceSlice, PanelKey, FallbackProduct } from './DashboardClient'
import { getKpis } from '@/lib/db/kpis'
import { getOrders } from '@/lib/db/orders'
import { getProducts, getProductSales, getCategoryRevenue } from '@/lib/db/products'
import { getDailyRevenue } from '@/lib/db/revenue'
import { getUserShops, getSyncInfo } from '@/lib/db/shop-context'
import WelcomePopup from '@/components/dashboard/WelcomePopup'
import type { MarketplaceType } from '@/lib/types'
import { startOfIsoWeek, endOfIsoWeek, localDateStr, shopWeekBounds } from '@/lib/period-week'
import { inclusiveDays } from '@/lib/kpi-windows'
import { getLang } from '@/lib/server-i18n'
import { currentUserAccess } from '@/lib/billing/current-user-access'
import FeatureLock from '@/components/dashboard/FeatureLock'

function parseDays(v: string | undefined): number {
  if (v === '1')     return 1
  if (v === '7')     return 7
  if (v === '30')    return 30
  if (v === '90')    return 90
  if (v === '365')   return 365
  if (v === 'month') return new Date().getDate() // days elapsed since 1st of current month
  return 365
}

const VALID_MARKETPLACES = ['uzum'] as const

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
  from?: string,
  to?: string,
): Promise<Omit<MarketplaceSlice, 'hasConnectedShop'>> {
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

  // SEND THE FIVE ROWS THE PAGE RENDERS, NOT THE WHOLE CATALOGUE.
  //
  // getProducts returns every non-archived listing with ~20 columns each. The
  // dashboard uses that for exactly two things: "is the catalogue empty?" and,
  // when nothing has sold in the period, a top-5-by-units fallback table
  // showing six fields. Everything else was serialised into the RSC payload,
  // shipped, parsed and discarded — on a seller with thousands of SKUs that is
  // megabytes per page load, and it is on the critical path to first paint.
  //
  // The query itself is unchanged (it is cached and shared with other pages);
  // only what crosses the wire shrinks.
  const fallbackProducts: FallbackProduct[] = [...allProducts]
    .sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0))
    .slice(0, 5)
    .map(p => ({
      id: p.id,
      title: p.title,
      sku: p.sku,
      marketplace: p.marketplace,
      selling_price: p.selling_price,
      sold: p.sold,
    }))

  return {
    kpis,
    recentOrders,
    productCount: allProducts.length,
    fallbackProducts,
    productSales,
    chartData,
    categoryData,
    failed,
  }
}

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function DashboardPage({ searchParams }: Props) {
  const [lang, access] = await Promise.all([getLang(), currentUserAccess('dashboard')])
  if (!access.allowed) return <FeatureLock lang={lang} feature="dashboard" hadTrial={access.trialEnded} />

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

  // ONE SLICE, AND THE SHOP LOOKUP ALONGSIDE IT.
  //
  // This used to fetch two slices — "all marketplaces" and "uzum" — to feed an
  // All / Uzum tab bar. With Yandex gone that bar no longer renders
  // (DashboardClient: `MP_TABS.length > 1`) and nothing links to ?mp=, so the
  // second slice was six more queries producing a copy of the first. Two of
  // them were genuinely duplicated work rather than cache hits, because
  // getKpis keys its cache on whether a marketplace filter is set.
  //
  // getUserShops was also awaited on its own first, purely because fetchSlice
  // took hasConnectedShop as an argument. It never influenced a query, so it
  // moves into the same Promise.all and is attached to the slice afterwards —
  // one less serial round trip before anything else starts.
  //
  // getStockGroups went entirely: it ran eight queries, three of them
  // aggregating the seller's whole order history, was not cached, and the
  // result reached a prop DashboardClient destructures and never reads (eslint
  // has been reporting it as unused). The stock figures the KPI card shows come
  // from getKpis, which computes its own groups behind a cache.
  const [slice, allShops, syncInfo] = await Promise.all([
    fetchSlice(days, undefined, from, to),
    getUserShops().catch(e => { console.error('[dashboard] getUserShops', e); return [] }),
    getSyncInfo().catch(e => { console.error('[dashboard] getSyncInfo', e); return { lastSyncedAt: null, lastSyncFailed: false, alerts: [] } }),
  ])
  const hasShops = allShops.length > 0

  return (
    <Suspense>
      <WelcomePopup hasShops={hasShops} />
      <DashboardClient
        slice={{ ...slice, hasConnectedShop: hasShops }}
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
