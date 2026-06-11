import { getT } from '@/lib/server-i18n'
import PriceTrackingView from '@/components/dashboard/PriceTrackingView'

export default async function PriceTrackingPage() {
  const t = await getT()
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.priceTrackingTitle}</h1>
        </div>
        <p className="text-[var(--text-muted)] text-sm">{d.priceTrackingSubtitle}</p>
      </div>
      <PriceTrackingView />
    </div>
  )
}
