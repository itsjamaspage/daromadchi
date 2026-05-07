import DataStateView from '@/components/dashboard/DataStateView'
import { getSyncDays } from '@/lib/db/sync-state'

export default async function DataStatePage() {
  const days = await getSyncDays(30)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Ma&apos;lumotlar holati</h1>
        <p className="text-slate-400 text-sm mt-1">So&apos;nggi 30 kunlik sinxronizatsiya holati va xatolarni boshqarish</p>
      </div>
      <DataStateView days={days} />
    </div>
  )
}
