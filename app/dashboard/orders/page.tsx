import { ShoppingCart, Settings } from 'lucide-react'
import Link from 'next/link'
import { getOrders } from '@/lib/db/orders'
import OrdersTable from '@/components/dashboard/OrdersTable'

export default async function OrdersPage() {
  const orders = await getOrders()

  if (orders.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Buyurtmalar</h1>
          <p className="text-slate-400 text-sm mt-1">0 ta buyurtma</p>
        </div>
        <div className="bg-[#13131f] border border-dashed border-violet-500/30 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-7 h-7 text-violet-400" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">Buyurtmalar yo'q</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            Uzum do'koningizni ulab, sinxronizatsiyani boshlang — buyurtmalar avtomatik import qilinadi.
          </p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
            <Settings className="w-4 h-4" /> Sozlamalarga o'tish
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Buyurtmalar</h1>
        <p className="text-slate-400 text-sm mt-1">{orders.length} ta buyurtma</p>
      </div>
      <OrdersTable orders={orders} />
    </div>
  )
}
