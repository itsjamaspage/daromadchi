import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import SettingsForm from './SettingsForm'
import type { Shop } from '@/lib/types'
import { getLang } from '@/lib/lang'
import { dashT } from '@/lib/dashT'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const lang = await getLang()
  const t = dashT[lang].settings

  let uzumShop:        Shop | null = null
  let yandexShop:      Shop | null = null
  let wildberriesShop: Shop | null = null

  if (user) {
    const { data } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', user.id)

    for (const row of data ?? []) {
      if (row.marketplace === 'uzum')          uzumShop        = row as Shop
      if (row.marketplace === 'yandex_market') yandexShop      = row as Shop
      if (row.marketplace === 'wildberries')   wildberriesShop = row as Shop
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-3 mb-0.5">
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-400">
            {t.badge}
          </span>
        </div>
        <p className="text-slate-400 text-sm">{t.subtitle}</p>
      </div>
      <Suspense>
        <SettingsForm
          uzumShop={uzumShop}
          yandexShop={yandexShop}
          wildberriesShop={wildberriesShop}
          userId={user?.id ?? ''}
        />
      </Suspense>
    </div>
  )
}
