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
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[rgba(131,192,249,0.12)] border border-[rgba(131,192,249,0.25)] text-[#83c0f9]">
              {stats.totalReferred} {d.friends}
            </span>
          </div>
          <p className="text-[var(--text-muted)] text-sm">{d.referralSubtitle}</p>
        </div>
        <Gift className="w-8 h-8 text-[#83c0f9]/50 ml-auto hidden sm:block" />
      </div>
      <ReferralView stats={stats} entries={entries} />
    </div>
  )
}
