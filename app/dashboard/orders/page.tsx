import { getOrders } from '@/lib/db/orders'
import OrdersTable from '@/components/dashboard/OrdersTable'

export default async function OrdersPage() {
  const orders = await getOrders()
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
