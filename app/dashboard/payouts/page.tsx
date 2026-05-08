import { CreditCard } from 'lucide-react'
import { getPayoutEntries } from '@/lib/db/payouts'
import PayoutsView from '@/components/dashboard/PayoutsView'

export default async function PayoutsPage() {
  const entries = await getPayoutEntries()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">To&apos;lovlar</h1>
          <p className="text-slate-400 text-sm">Marketplace to&apos;lovlari va chegirmalar tahlili</p>
        </div>
      </div>

      <PayoutsView entries={entries} />
    </div>
  )
}
