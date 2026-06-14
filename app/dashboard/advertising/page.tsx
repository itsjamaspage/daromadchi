import AdvertisingView from '@/components/dashboard/AdvertisingView'
import { getAdCampaigns, getWbAdCampaigns } from '@/lib/db/advertising'
import AdvertisingHeader from '@/components/dashboard/AdvertisingHeader'

export default async function AdvertisingPage() {
  const [uzumCampaigns, wbCampaigns] = await Promise.all([
    getAdCampaigns(),
    getWbAdCampaigns(),
  ])

  return (
    <div className="space-y-6">
      <AdvertisingHeader />
      <AdvertisingView uzumCampaigns={uzumCampaigns} wbCampaigns={wbCampaigns} />
    </div>
  )
}
