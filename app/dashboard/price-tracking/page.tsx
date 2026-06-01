import { getT } from '@/lib/server-i18n'
import { getCompetitorPrices } from '@/lib/db/price-tracking'
import PriceTrackingView from '@/components/dashboard/PriceTrackingView'

export default async function PriceTrackingPage() {
  const [t, prices] = await Promise.all([getT(), getCompetitorPrices()])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{d.priceTrackingTitle}</h1>
        <p className="text-slate-400 text-sm mt-1">{d.priceTrackingSubtitle}</p>
      </div>
      <PriceTrackingView prices={prices} />
    </div>
  )
}
