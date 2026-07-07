import { eq, ne, and, count } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { db, shops, products, orders } from '@/lib/db'
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

  const [shopRows, uzumDays, yandexDays, wbDays] = await Promise.all([
    db.select({
      id: shops.id,
      name: shops.name,
      marketplace: shops.marketplace,
      api_key_encrypted: shops.api_key_encrypted,
      last_synced_at: shops.last_synced_at,
      shop_id_external: shops.shop_id_external,
    }).from(shops)
      .where(eq(shops.user_id, user.id)),
    getSyncDays('uzum', 30),
    getSyncDays('yandex_market', 30),
    getSyncDays('wildberries', 30),
  ])

  const filteredShops = shopRows.filter(s => s.shop_id_external !== 'DEMO')

  const shopsWithCounts = await Promise.all(
    filteredShops.map(async shop => {
      const [[{ total: productCount }], [{ total: orderCount }]] = await Promise.all([
        db.select({ total: count() }).from(products).where(eq(products.shop_id, shop.id)),
        db.select({ total: count() }).from(orders).where(eq(orders.shop_id, shop.id)),
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
