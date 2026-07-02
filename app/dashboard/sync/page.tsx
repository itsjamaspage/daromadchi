import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserId } from '@/lib/db/shop-context'
import { getSyncDays } from '@/lib/db/sync-state'
import SyncStatusClient from './SyncStatusClient'
import { getLang } from '@/lib/lang'
import { dashT } from '@/lib/dashT'

export default async function SyncStatusPage() {
  const supabase = await createClient()
  const lang = await getLang()
  const t = dashT[lang].sync

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: shops }, uzumDays, yandexDays, wbDays] = await Promise.all([
    supabase
      .from('shops')
      .select('id, name, marketplace, api_key_encrypted, last_synced_at, shop_id_external')
      .eq('user_id', user.id),
    getSyncDays('uzum', 30),
    getSyncDays('yandex_market', 30),
    getSyncDays('wildberries', 30),
  ])

  const filteredShops = (shops ?? []).filter(s => s.shop_id_external !== 'DEMO')

  const shopsWithCounts = await Promise.all(
    filteredShops.map(async shop => {
      const [{ count: productCount }, { count: orderCount }] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id),
      ])
      return { ...shop, productCount: productCount ?? 0, orderCount: orderCount ?? 0 }
    })
  )

  const connectedMps = filteredShops.map(s => s.marketplace).filter((v, i, a) => a.indexOf(v) === i)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-base)]">{t.title}</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">{t.subtitle}</p>
      </div>
      <SyncStatusClient
        shops={shopsWithCounts}
        uzumDays={uzumDays}
        yandexDays={yandexDays}
        wbDays={wbDays}
        connectedMps={connectedMps}
      />
    </div>
  )
}
