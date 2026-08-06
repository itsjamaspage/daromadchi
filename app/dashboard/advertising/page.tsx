import { Megaphone } from 'lucide-react'
import { getAdSpendByMarketplace } from '@/lib/db/ads'
import AdSpendView from '@/components/dashboard/AdSpendView'
import { getT } from '@/lib/server-i18n'

export default async function AdvertisingPage() {
  const [t, rows] = await Promise.all([getT(), getAdSpendByMarketplace()])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-card2)] border border-[var(--border)] flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-[var(--c1)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.advertisingTitle}</h1>
          <p className="text-[var(--text-muted)] text-sm">{d.advertisingSubtitle}</p>
        </div>
      </div>

      <AdSpendView rows={rows} />
    </div>
  )
}
