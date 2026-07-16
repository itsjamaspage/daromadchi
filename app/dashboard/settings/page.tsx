import { getT } from '@/lib/server-i18n'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { shops, userSettings, products, orders } from '@/lib/db/schema'
import { eq, count } from 'drizzle-orm'
import SettingsForm from './SettingsForm'
import type { Shop } from '@/lib/types'

export default async function SettingsPage() {
  const [t, user] = await Promise.all([getT(), getCurrentUser()])
  const d = t.dashboard

  let uzumShop:   Shop | null = null
  let yandexShop: Shop | null = null
  let wbShop:     Shop | null = null
  const shopCounts: Record<string, { products: number; orders: number }> = {}

  if (user) {
    const rows = await db
      .select()
      .from(shops)
      .where(eq(shops.user_id, user.id))

    for (const row of rows) {
      if (row.shop_id_external === 'DEMO') continue
      const s = { ...row, created_at: row.created_at.toISOString(), last_synced_at: row.last_synced_at?.toISOString() ?? null } as Shop
      if (row.marketplace === 'uzum')          uzumShop   = s
      if (row.marketplace === 'yandex_market') yandexShop = s
      if (row.marketplace === 'wildberries')   wbShop     = s
    }

    const shopsWithKeys = [uzumShop, yandexShop, wbShop].filter(Boolean) as Shop[]
    await Promise.all(shopsWithKeys.map(async s => {
      const [[{ total: pc }], [{ total: oc }]] = await Promise.all([
        db.select({ total: count() }).from(products).where(eq(products.shop_id, s.id)),
        db.select({ total: count() }).from(orders).where(eq(orders.shop_id, s.id)),
      ])
      shopCounts[s.marketplace] = { products: pc ?? 0, orders: oc ?? 0 }
    }))
  }

  let telegramChatId:   string | null = null
  let telegramUsername: string | null = null
  if (user) {
    const tg = await db.query.userSettings.findFirst({
      where: eq(userSettings.user_id, user.id),
      columns: { telegram_chat_id: true, telegram_username: true },
    })
    telegramChatId  = tg?.telegram_chat_id  ?? null
    telegramUsername = tg?.telegram_username ?? null
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-0.5">
          <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.settingsTitle}</h1>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[var(--bg-card2)] border border-[var(--border)] text-[var(--c1)]">
            {d.yourData}
          </span>
        </div>
        <p className="text-[var(--text-muted)] text-sm">{d.settingsSubtitle}</p>
      </div>
      <SettingsForm
        uzumShop={uzumShop}
        yandexShop={yandexShop}
        wbShop={wbShop}
        shopCounts={shopCounts}
        userId={user?.id ?? ''}
        telegramChatId={telegramChatId}
        telegramUsername={telegramUsername}
      />
    </div>
  )
}
