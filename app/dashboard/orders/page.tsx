import { Suspense } from 'react'
import { ShoppingCart, Settings } from 'lucide-react'
import Link from 'next/link'
import { getOrdersPaginated } from '@/lib/db/orders'
import { getUserShops } from '@/lib/db/shop-context'
import OrdersTable from '@/components/dashboard/OrdersTable'
import MarketplaceTabs from '@/components/dashboard/MarketplaceTabs'
import Pagination from '@/components/dashboard/Pagination'
import { getT } from '@/lib/server-i18n'
import type { MarketplaceType } from '@/lib/types'

const PAGE_SIZE = 50
const VALID_MARKETPLACES = ['uzum', 'yandex_market', 'wildberries'] as const

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function OrdersPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const mp = (VALID_MARKETPLACES as readonly string[]).includes(params.mp ?? '')
    ? (params.mp as MarketplaceType)
    : undefined

  const [t, { rows: orders, total }, userShops] = await Promise.all([
    getT(),
    getOrdersPaginated(page, PAGE_SIZE, mp),
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

      <Suspense>
        <MarketplaceTabs current={mp} />
      </Suspense>

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
