import { getCompetitorPrices } from '@/lib/db/price-tracking'
import PriceTrackingView from '@/components/dashboard/PriceTrackingView'

export default async function PriceTrackingPage() {
  const prices = await getCompetitorPrices()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Narx kuzatuvi</h1>
        <p className="text-slate-400 text-sm mt-1">Raqobatchilar narxlarini kuzating va pozitsiyangizni biling</p>
      </div>
      <PriceTrackingView prices={prices} />
    </div>
  )
}
