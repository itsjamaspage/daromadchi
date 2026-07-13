import { getT } from '@/lib/server-i18n'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { shops, userSettings } from '@/lib/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import SettingsForm from './SettingsForm'
import type { Shop } from '@/lib/types'

export default async function SettingsPage() {
  const [t, user] = await Promise.all([getT(), getCurrentUser()])
  const d = t.dashboard

  let uzumShop:   Shop | null = null
  let yandexShop: Shop | null = null
  let wbShop:     Shop | null = null

  if (user) {
    const rows = await db
      .select()
      .from(shops)
      .where(and(eq(shops.user_id, user.id), ne(shops.shop_id_external, 'DEMO')))

    for (const row of rows) {
      const s = { ...row, created_at: row.created_at.toISOString(), last_synced_at: row.last_synced_at?.toISOString() ?? null } as Shop
      if (row.marketplace === 'uzum')          uzumShop   = s
      if (row.marketplace === 'yandex_market') yandexShop = s
      if (row.marketplace === 'wildberries')   wbShop     = s
    }
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
    <div className="space-y-6 max-w-2xl">
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
        userId={user?.id ?? ''}
        telegramChatId={telegramChatId}
        telegramUsername={telegramUsername}
      />
    </div>
  )
}
