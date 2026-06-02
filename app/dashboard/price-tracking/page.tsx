import { getT } from '@/lib/server-i18n'
import { getCompetitorPrices } from '@/lib/db/price-tracking'
import PriceTrackingView from '@/components/dashboard/PriceTrackingView'
import HelpTooltip from '@/components/dashboard/HelpTooltip'

export default async function PriceTrackingPage() {
  const [t, prices] = await Promise.all([getT(), getCompetitorPrices()])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold text-white">{d.priceTrackingTitle}</h1>
          <HelpTooltip section="priceTracking" />
        </div>
        <p className="text-slate-400 text-sm">{d.priceTrackingSubtitle}</p>
      </div>
      <PriceTrackingView prices={prices} />
    </div>
  )
}
