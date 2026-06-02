import AdvertisingView from '@/components/dashboard/AdvertisingView'
import { getAdCampaigns } from '@/lib/db/advertising'
import { getT } from '@/lib/server-i18n'
import HelpTooltip from '@/components/dashboard/HelpTooltip'

export default async function AdvertisingPage() {
  const t = await getT()
  const d = t.dashboard
  const campaigns = await getAdCampaigns()

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold text-white">{d.advertisingTitle}</h1>
          <HelpTooltip section="advertising" />
        </div>
        <p className="text-slate-400 text-sm">{d.advertisingSubtitle}</p>
      </div>
      <AdvertisingView campaigns={campaigns} />
    </div>
  )
}
