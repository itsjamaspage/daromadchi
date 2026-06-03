import { getT } from '@/lib/server-i18n'
import { Gift } from 'lucide-react'
import { getReferralStats } from '@/lib/db/referral'
import ReferralView from '@/components/dashboard/ReferralView'

export default async function ReferralPage() {
  const [t, { stats, entries }] = await Promise.all([getT(), getReferralStats()])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.referralTitle}</h1>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-400">
              {stats.totalReferred} {d.friends}
            </span>
          </div>
          <p className="text-[var(--text-muted)] text-sm">{d.referralSubtitle}</p>
        </div>
        <Gift className="w-8 h-8 text-violet-400/50 ml-auto hidden sm:block" />
      </div>
      <ReferralView stats={stats} entries={entries} />
    </div>
  )
}
