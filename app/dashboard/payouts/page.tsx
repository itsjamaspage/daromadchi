import { CreditCard } from 'lucide-react'
import { getPayoutEntries } from '@/lib/db/payouts'
import PayoutsView from '@/components/dashboard/PayoutsView'
import { getT } from '@/lib/server-i18n'

export default async function PayoutsPage() {
  const [t, entries] = await Promise.all([getT(), getPayoutEntries()])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.payoutsTitle}</h1>
          </div>
          <p className="text-[var(--text-muted)] text-sm">{d.payoutsSubtitle}</p>
        </div>
      </div>

      <PayoutsView entries={entries} />
    </div>
  )
}
