import { Suspense } from 'react'
import { ShoppingCart, Settings } from 'lucide-react'
import Link from 'next/link'
import { getOrdersPaginated } from '@/lib/db/orders'
import { getUserShops } from '@/lib/db/shop-context'
import OrdersTable from '@/components/dashboard/OrdersTable'
import MarketplaceTabs from '@/components/dashboard/MarketplaceTabs'
import Pagination from '@/components/dashboard/Pagination'
import LastSyncedServer from '@/components/dashboard/LastSyncedServer'
import { getT } from '@/lib/server-i18n'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import { startOfIsoWeek, endOfIsoWeek, localDateStr } from '@/lib/period-week'
import type { MarketplaceType } from '@/lib/types'

const PAGE_SIZE = 50
const VALID_MARKETPLACES = ['uzum', 'yandex_market'] as const

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function OrdersPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const mp = (VALID_MARKETPLACES as readonly string[]).includes(params.mp ?? '')
    ? (params.mp as MarketplaceType)
    : undefined

  // Same window as the dashboard: the CURRENT WEEK (Mon–Sun) unless the picker
  // says otherwise, with ‹ › paging a calendar week at a time. Shared week maths
  // — see lib/period-week.ts — so the two pages can never disagree about which
  // days "this week" means.
  const now = new Date()
  const from = params.from || localDateStr(startOfIsoWeek(now))
  const to   = params.to   || localDateStr(endOfIsoWeek(now))

  const [t, { rows: orders, total }, userShops] = await Promise.all([
    getT(),
    getOrdersPaginated(page, PAGE_SIZE, mp, from, to),
    getUserShops(),
  ])
  const d = t.dashboard
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasShops = userShops.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-0.5" style={{ color: 'var(--text-base)' }}>{d.ordersTitle}</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{total} {d.orderCount}</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <Suspense>
          <MarketplaceTabs current={mp} />
        </Suspense>
        <div className="flex items-center gap-3">
          <Suspense>
            <DateRangePicker period="" from={from} to={to} presets={[]} />
          </Suspense>
          <Suspense>
            <LastSyncedServer />
          </Suspense>
        </div>
      </div>

      {total === 0 ? (
        <div className="border border-dashed rounded-2xl p-10 text-center" style={{ background: 'var(--bg-card2)', borderColor: 'rgba(131, 192, 249, 0.3)' }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(131, 192, 249, 0.1)', borderColor: 'rgba(131, 192, 249, 0.2)', color: 'var(--c1)' }}>
            <ShoppingCart className="w-7 h-7" />
          </div>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text-base)' }}>
            {hasShops ? d.noOrdersConnectedTitle : d.noOrdersTitle}
          </h2>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
            {hasShops ? d.noOrdersConnectedDesc : d.noOrdersDesc}
          </p>
          {!hasShops && (
            <Link href="/dashboard/settings"
              className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors btn-primary">
              <Settings className="w-4 h-4" /> {d.goToSettings}
            </Link>
          )}
        </div>
      ) : (
        <>
          <OrdersTable orders={orders} />
          <Pagination page={page} totalPages={totalPages} basePath="/dashboard/orders" />
        </>
      )}
    </div>
  )
}
