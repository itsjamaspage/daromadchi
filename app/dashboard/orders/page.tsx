import { ShoppingCart, Settings } from 'lucide-react'
import Link from 'next/link'
import { getOrders } from '@/lib/db/orders'
import OrdersTable from '@/components/dashboard/OrdersTable'
import { getT } from '@/lib/server-i18n'

export default async function OrdersPage() {
  const [t, orders] = await Promise.all([getT(), getOrders()])
  const d = t.dashboard

  if (orders.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>{d.ordersTitle}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>0 {d.orderCount}</p>
        </div>
        <div className="border border-dashed rounded-2xl p-10 text-center" style={{ background: 'var(--bg-card2)', borderColor: 'rgba(124, 58, 237, 0.3)' }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(124, 58, 237, 0.1)', borderColor: 'rgba(124, 58, 237, 0.2)', color: '#7c3aed' }}>
            <ShoppingCart className="w-7 h-7" />
          </div>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text-base)' }}>{d.noOrdersTitle}</h2>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
            {d.noOrdersDesc}
          </p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            style={{ background: '#7c3aed', color: 'white' }}>
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
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{orders.length} {d.orderCount}</p>
      </div>
      <OrdersTable orders={orders} />
    </div>
  )
}
