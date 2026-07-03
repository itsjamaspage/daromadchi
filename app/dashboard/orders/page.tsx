import { ShoppingCart, Settings } from 'lucide-react'
import Link from 'next/link'
import { getOrdersPaginated } from '@/lib/db/orders'
import OrdersTable from '@/components/dashboard/OrdersTable'
import Pagination from '@/components/dashboard/Pagination'
import { getT } from '@/lib/server-i18n'

const PAGE_SIZE = 50

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function OrdersPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const [t, { rows: orders, total }] = await Promise.all([
    getT(),
    getOrdersPaginated(page, PAGE_SIZE),
  ])
  const d = t.dashboard
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (total === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>{d.ordersTitle}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>0 {d.orderCount}</p>
        </div>
        <div className="border border-dashed rounded-2xl p-10 text-center" style={{ background: 'var(--bg-card2)', borderColor: 'rgba(131, 192, 249, 0.3)' }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(131, 192, 249, 0.1)', borderColor: 'rgba(131, 192, 249, 0.2)', color: 'var(--c1)' }}>
            <ShoppingCart className="w-7 h-7" />
          </div>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text-base)' }}>{d.noOrdersTitle}</h2>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
            {d.noOrdersDesc}
          </p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            style={{ background: 'var(--c1)', color: 'white' }}>
            <Settings className="w-4 h-4" /> {d.goToSettings}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>{d.ordersTitle}</h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{total} {d.orderCount}</p>
      </div>
      <OrdersTable orders={orders} />
      <Pagination page={page} totalPages={totalPages} basePath="/dashboard/orders" />
    </div>
  )
}
