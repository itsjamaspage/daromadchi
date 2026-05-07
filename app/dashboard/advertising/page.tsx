import AdvertisingView from '@/components/dashboard/AdvertisingView'
import { adCampaigns } from '@/lib/mock-data'

export default function AdvertisingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reklama</h1>
        <p className="text-slate-400 text-sm mt-1">CPC va CPO reklama kampaniyalari tahlili</p>
      </div>
      <AdvertisingView campaigns={adCampaigns} />
    </div>
  )
}
