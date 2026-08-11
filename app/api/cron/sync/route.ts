import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { eq, and, isNotNull } from 'drizzle-orm'
import { db, shops, users, userSettings } from '@/lib/db'
import { syncFromUzum } from '@/lib/uzum/sync'
import { syncFromYandex } from '@/lib/yandex/sync'
import { syncYandexSettlements } from '@/lib/yandex/settlements-sync'
import { syncUzumSettlements } from '@/lib/uzum/settlements-sync'
import { decrypt } from '@/lib/crypto'
import { withErrorHandler } from '@/lib/api-handler'
import { sendTelegramMessage } from '@/lib/telegram'

export const runtime    = 'nodejs'
export const maxDuration = 300

const CONCURRENCY = 5

const MP_LABEL: Record<string, string> = {
  uzum: 'Uzum Market',
  yandex_market: 'Yandex Market',
}

const SYNC_INTERVAL_MS: Record<string, number> = {
  free:     6 * 60 * 60 * 1000,
  pro:      2 * 60 * 60 * 1000,
  pro_plus: 30 * 60 * 1000,
}

function getEffectivePlan(user: { plan: string; plan_expires_at: Date | null; trial_ends_at: Date | null }): string {
  const plan = user.plan ?? 'free'
  if (plan !== 'free' && user.plan_expires_at) {
    if (new Date(user.plan_expires_at) < new Date()) return 'free'
  }
  if (plan === 'free' && user.trial_ends_at) {
    if (new Date(user.trial_ends_at) > new Date()) return 'pro'
  }
  return plan
}

async function syncShop(
  shop: { id: string; marketplace: string; api_key_encrypted: string; shop_id_external: string | null },
  heavy: boolean,
): Promise<Record<string, unknown>> {
  const start = Date.now()
  try {
    const token = decrypt(shop.api_key_encrypted)
    let r: { ok: boolean; [key: string]: unknown } | undefined
    if (shop.marketplace === 'uzum') {
      r = { ...await syncFromUzum(shop.id, token, heavy) }
      // Settlements are heavy (extra API + async reports) — only on a heavy tick.
      // Also pull real per-order-item financials from /v1/finance/orders
      // so Payouts shows Uzum's authoritative commission / delivery /
      // net instead of the Unit-Economics estimate. Guarded so a
      // finance-endpoint hiccup doesn't fail the primary sync.
      if (heavy) {
        try {
          const s = await syncUzumSettlements(shop.id, token)
          ;(r as Record<string, unknown>).settlements = s
        } catch (e) {
          ;(r as Record<string, unknown>).settlements = { ok: false, error: String(e).slice(0, 300) }
        }
      }
    } else if (shop.marketplace === 'yandex_market' && shop.shop_id_external) {
      r = { ...await syncFromYandex(shop.id, token, shop.shop_id_external, undefined, heavy) }
      // Settlements are heavy (async report API can take minutes) — only on a
      // heavy tick. Kept behind try/catch so a settlement failure never blocks
      // the primary orders sync from being marked ok.
      if (heavy) {
        try {
          const s = await syncYandexSettlements(shop.id, token, shop.shop_id_external)
          ;(r as Record<string, unknown>).settlements = s
        } catch (e) {
          ;(r as Record<string, unknown>).settlements = { ok: false, error: String(e).slice(0, 300) }
        }
      }
    }
    if (!r) return { shopId: shop.id, marketplace: shop.marketplace, ok: true, skipped: true }
    return { shopId: shop.id, marketplace: shop.marketplace, ms: Date.now() - start, ...r }
  } catch (err) {
    return { shopId: shop.id, marketplace: shop.marketplace, ms: Date.now() - start, ok: false, error: String(err) }
  }
}

export const GET = withErrorHandler(async (req: Request) => {
  const url    = new URL(req.url)
  const secret = req.headers.get('x-cron-secret') ?? url.searchParams.get('secret')

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const allShops = await db.select({
    id: shops.id,
    user_id: shops.user_id,
    name: shops.name,
    marketplace: shops.marketplace,
    api_key_encrypted: shops.api_key_encrypted,
    shop_id_external: shops.shop_id_external,
    last_synced_at: shops.last_synced_at,
  }).from(shops)
    .where(and(eq(shops.is_active, true), isNotNull(shops.api_key_encrypted)))

  const userIds = [...new Set(allShops.map(s => s.user_id))]
  const userRows = userIds.length > 0
    ? await db.select({
        id: users.id,
        plan: users.plan,
        plan_expires_at: users.plan_expires_at,
        trial_ends_at: users.trial_ends_at,
      }).from(users)
    : []
  const userPlanMap = new Map<string, string>()
  for (const u of userRows) {
    userPlanMap.set(u.id, getEffectivePlan(u))
  }

  const now = Date.now()
  // Every active shop syncs its ORDERS on every 5-min tick, so new-order
  // Telegram alerts fire near-real-time regardless of plan. The plan interval
  // now only decides whether this tick ALSO runs the heavy work (product
  // catalog + settlements) and advances last_synced_at — previously the whole
  // sync was gated behind the interval, so a `pro` user could wait up to 2h and
  // a `free` user up to 6h for a "new order" alert.
  const shopsToSync = allShops.map(s => {
    const plan = userPlanMap.get(s.user_id) ?? 'free'
    const interval = SYNC_INTERVAL_MS[plan] ?? SYNC_INTERVAL_MS.free
    const heavy = !s.last_synced_at || (now - new Date(s.last_synced_at).getTime() >= interval)
    return { ...s, heavy }
  })

  const results: Record<string, unknown>[] = []
  const heavyCount = shopsToSync.filter(s => s.heavy).length

  for (let i = 0; i < shopsToSync.length; i += CONCURRENCY) {
    const batch = shopsToSync.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(
      batch.map(s => syncShop({ ...s, api_key_encrypted: s.api_key_encrypted! }, s.heavy))
    )
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value)
      } else {
        results.push({ ok: false, error: String(outcome.reason) })
      }
    }
  }

  // ── Real-time "new order to fulfill" Telegram alerts ──
  // Only orders actually INSERTED this run in an actionable status
  // (pending/confirmed) trigger an alert — ordersUpserted counts every
  // re-synced old order and used to spam users hours after the fact.
  // First-ever syncs (last_synced_at null) are backfills, not new orders.
  const ordersByUser = new Map<string, { marketplace: string; name: string | null; lines: string[] }[]>()
  for (const r of results) {
    const newOrders = (r.newOrders as string[] | undefined) ?? []
    if (newOrders.length === 0) continue
    const shop = shopsToSync.find(s => s.id === r.shopId)
    if (!shop || !shop.last_synced_at) continue
    const list = ordersByUser.get(shop.user_id) ?? []
    list.push({ marketplace: shop.marketplace, name: shop.name, lines: newOrders })
    ordersByUser.set(shop.user_id, list)
  }

  if (ordersByUser.size > 0) {
    const settingsRows = await db.select({
      user_id: userSettings.user_id,
      telegram_chat_id: userSettings.telegram_chat_id,
      notif_new_orders: userSettings.notif_new_orders,
    }).from(userSettings)
      .where(and(
        isNotNull(userSettings.telegram_chat_id),
      ))

    for (const s of settingsRows) {
      if (!s.notif_new_orders || !s.telegram_chat_id) continue
      const shopOrders = ordersByUser.get(s.user_id)
      if (!shopOrders) continue

      const total = shopOrders.reduce((sum, o) => sum + o.lines.length, 0)
      const blocks = shopOrders.map(o => {
        const mpName = MP_LABEL[o.marketplace] ?? o.marketplace
        const detail = o.lines.slice(0, 10).map(l => `   ${l}`).join('\n')
        const more = o.lines.length > 10 ? `\n   …va yana ${o.lines.length - 10} ta` : ''
        return `• ${mpName}: <b>${o.lines.length}</b> ta yangi buyurtma\n${detail}${more}`
      }).join('\n')

      const msg = `🛒 <b>Yangi buyurtma${total > 1 ? `lar (${total})` : ''}!</b>\nYig'ib jo'natish kerak:\n\n${blocks}\n\nBatafsil: https://daromadchi.uz/dashboard/orders`

      try {
        await sendTelegramMessage(s.telegram_chat_id, msg)
      } catch { /* best-effort */ }
    }
  }

  // Invalidate cached product/order pages if anything actually synced, so
  // dashboards show fresh numbers on the next request.
  if (results.some(r => r.ok)) {
    revalidateTag('product-data', { expire: 0 })
    revalidateTag('order-data', { expire: 0 })
    // Settlements ride the same sync — Yandex netting-report + Uzum
    // finance/orders both refresh here, so blow away the shared tag
    // Dashboard / P&L / Payouts all subscribe to.
    revalidateTag('settlements', { expire: 0 })
  }

  return NextResponse.json({ ok: true, synced: results.length, heavy: heavyCount, results })
})
