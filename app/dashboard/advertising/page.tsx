import AdvertisingView from '@/components/dashboard/AdvertisingView'
import { getAdCampaigns } from '@/lib/db/advertising'
import { getT } from '@/lib/server-i18n'

export default async function AdvertisingPage() {
  const t = await getT()
  const d = t.dashboard
  const campaigns = await getAdCampaigns()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{d.advertisingTitle}</h1>
        <p className="text-slate-400 text-sm mt-1">{d.advertisingSubtitle}</p>
      </div>
      <AdvertisingView campaigns={campaigns} />
    </div>
  )
}
