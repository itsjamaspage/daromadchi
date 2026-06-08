import AdvertisingView from '@/components/dashboard/AdvertisingView'
import { getAdCampaigns, getWbAdCampaigns } from '@/lib/db/advertising'
import AdvertisingHeader from '@/components/dashboard/AdvertisingHeader'

export default async function AdvertisingPage() {
  const [uzumCampaigns, wbCampaigns] = await Promise.all([
    getAdCampaigns(),
    getWbAdCampaigns(),
  ])
  const campaigns = [...uzumCampaigns, ...wbCampaigns]

  return (
    <div className="space-y-6">
      <AdvertisingHeader />
      <AdvertisingView campaigns={campaigns} />
    </div>
  )
}
