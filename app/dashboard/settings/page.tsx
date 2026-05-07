import { createClient } from '@/lib/supabase/server'
import { getUnitEcoSettings } from '@/lib/db/unit-economics'
import SettingsForm from './SettingsForm'
import type { Shop } from '@/lib/types'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let uzumShop:   Shop | null = null
  let yandexShop: Shop | null = null

  if (user) {
    const { data } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', user.id)

    for (const row of data ?? []) {
      if (row.marketplace === 'uzum')          uzumShop   = row as Shop
      if (row.marketplace === 'yandex_market') yandexShop = row as Shop
    }
  }

  const ueSettings = await getUnitEcoSettings()

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-3 mb-0.5">
          <h1 className="text-2xl font-bold text-white">Sozlamalar</h1>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-400">
            Sizning ma&apos;lumotingiz
          </span>
        </div>
        <p className="text-slate-400 text-sm">Marketplace integratsiyalari va standart sozlamalar</p>
      </div>
      <SettingsForm
        uzumShop={uzumShop}
        yandexShop={yandexShop}
        userId={user?.id ?? ''}
        ueSettings={ueSettings}
      />
    </div>
  )
}
