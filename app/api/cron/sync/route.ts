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
import { sendSellerMessageTo } from '@/lib/telegram-seller'
import type { NotifStrings } from '@/lib/notif-i18n'
import { reconcilePhysicalStock } from '@/lib/marketplace/physical-stock'
import { refreshUzumStock, refreshYandexStock } from '@/lib/marketplace/stock-refresh'
import { notifyManualStockUpdates } from '@/lib/marketplace/manual-stock-notify'
import { logger } from '@/lib/logger'
import { computeEffectivePlan } from '@/lib/billing/features'

export const runtime    = 'nodejs'
export const maxDuration = 300

const CONCURRENCY = 5

const MP_LABEL: Record<string, string> = {
  uzum: 'Uzum Market',
  yandex_market: 'Yandex Market',
}

// Stock re-reads on its own fixed clock, the same shape PR #155 gave orders.
// NOT plan-gated: a stale stock number is what makes the app look like it does
// not update itself, and that impression is identical on every plan. The
// expensive work below stays throttled.
const STOCK_REFRESH_MS = 15 * 60 * 1000

const SYNC_INTERVAL_MS: Record<string, number> = {
  free:     6 * 60 * 60 * 1000,
  pro:      2 * 60 * 60 * 1000,
  pro_plus: 30 * 60 * 1000,
}

// Delegates to the shared rule in lib/billing/features so sync, diagnostics and
// lib/api/auth cannot drift apart on what "effective plan" means.
function getEffectivePlan(user: { plan: string; plan_expires_at: Date | null; trial_ends_at: Date | null }): string {
  return computeEffectivePlan({
    plan: user.plan,
    planExpiresAt: user.plan_expires_at,
    trialEndsAt: user.trial_ends_at,
  })
}

async function syncShop(
  shop: { id: string; marketplace: string; api_key_encrypted: string; shop_id_external: string | null },
  heavy: boolean,
  stockDue: boolean,
): Promise<Record<string, unknown>> {
  const start = Date.now()
  try {
    const token = decrypt(shop.api_key_encrypted)
    // Stock-only refresh. Skipped when this tick is already heavy — the heavy
    // pass re-reads the same quantities from the same endpoint, so running both
    // would double the calls to write the identical number.
    let stockRefresh: Record<string, unknown> | undefined
    if (stockDue && !heavy) {
      const sr = shop.marketplace === 'uzum'
        ? await refreshUzumStock(shop.id, token, shop.shop_id_external)
        : shop.marketplace === 'yandex_market' && shop.shop_id_external
          ? await refreshYandexStock(shop.id, token, shop.shop_id_external)
          : null
      stockRefresh = sr ? { ...sr } : undefined
      if (sr?.ok) {
        // Only advance the stock clock on a real read. A failed refresh must
        // stay due, or one bad tick would push the next attempt out 15 minutes.
        await db.update(shops).set({ stock_synced_at: new Date() }).where(eq(shops.id, shop.id))
        // physical_stock feeds the write-back pool and would otherwise sit on
        // the heavy pass's clock while stock_quantity moved every 15 min.
        try {
          await reconcilePhysicalStock(shop.id)
        } catch (e) {
          logger.warn('physical_stock_reconcile_failed', { shopId: shop.id, error: String(e).slice(0, 200) })
        }
      }
    }
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
    if (!r) return { shopId: shop.id, marketplace: shop.marketplace, ok: true, skipped: true, ...(stockRefresh ? { stockRefresh } : {}) }
    // After a heavy product sync refreshed stock_quantity from the live listings,
    // reconcile physical_stock (the shared pool that drives `available`): adopt a
    // listing read as the pool ONLY when it's seller-originated — differs from our
    // most-recent stock write — never when it equals our own throttle. This is
    // what keeps our mirror writes from ever feeding the pool. Best-effort — a
    // reconcile failure must never fail the sync.
    if (heavy && r.ok) {
      try {
        await reconcilePhysicalStock(shop.id)
      } catch (e) {
        logger.warn('physical_stock_reconcile_failed', { shopId: shop.id, error: String(e).slice(0, 200) })
      }
    }
    return { shopId: shop.id, marketplace: shop.marketplace, ms: Date.now() - start, ...r, ...(stockRefresh ? { stockRefresh } : {}) }
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
    stock_synced_at: shops.stock_synced_at,
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
    // Independent of `heavy` and of the plan. Null reads as "never refreshed",
    // so the first tick after deploy refreshes every shop.
    const stockDue = !s.stock_synced_at || (now - new Date(s.stock_synced_at).getTime() >= STOCK_REFRESH_MS)
    return { ...s, heavy, stockDue }
  })

  const results: Record<string, unknown>[] = []
  const heavyCount = shopsToSync.filter(s => s.heavy).length
  const stockCount = shopsToSync.filter(s => s.stockDue && !s.heavy).length

  for (let i = 0; i < shopsToSync.length; i += CONCURRENCY) {
    const batch = shopsToSync.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(
      batch.map(s => syncShop({ ...s, api_key_encrypted: s.api_key_encrypted! }, s.heavy, s.stockDue))
    )
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value)
      } else {
        results.push({ ok: false, error: String(outcome.reason) })
      }
    }
  }

  // ── Read-only "update your stock manually" reminders ──
  // For sellers on read-only keys (Daromadchi never writes their stock): after
  // this tick's stock refresh, tell them the exact number to set BY HAND on any
  // out-of-sync linked listing. Per USER (groups are cross-shop), and only for
  // users selling on ≥2 marketplaces — a single-marketplace seller has nothing to
  // reconcile. Deduped per divergence value, best-effort, and NEVER writes to a
  // marketplace (see lib/marketplace/manual-stock-notify.ts).
  {
    const mpByUser = new Map<string, Set<string>>()
    for (const s of allShops) {
      const set = mpByUser.get(s.user_id) ?? new Set<string>()
      set.add(s.marketplace)
      mpByUser.set(s.user_id, set)
    }
    for (const uid of userIds) {
      if ((mpByUser.get(uid)?.size ?? 0) < 2) continue
      await notifyManualStockUpdates(uid)   // internally best-effort; never throws
    }
  }

  // ── Real-time "new order to fulfill" Telegram alerts ──
  // Only orders actually INSERTED this run in an actionable status
  // (pending/confirmed) trigger an alert — ordersUpserted counts every
  // re-synced old order and used to spam users hours after the fact.
  // First-ever syncs (last_synced_at null) are backfills, not new orders.
  const ordersByUser = new Map<string, { marketplace: string; name: string | null; lines: string[] }[]>()
  const cancelsByUser = new Map<string, { marketplace: string; name: string | null; lines: string[] }[]>()
  for (const r of results) {
    const shop = shopsToSync.find(s => s.id === r.shopId)
    // The first-ever sync of a shop is a backfill, not a stream of events —
    // announcing its whole order history, cancellations included, would be a
    // wall of notifications for orders long since settled.
    if (!shop || !shop.last_synced_at) continue

    const newOrders = (r.newOrders as string[] | undefined) ?? []
    if (newOrders.length > 0) {
      const list = ordersByUser.get(shop.user_id) ?? []
      list.push({ marketplace: shop.marketplace, name: shop.name, lines: newOrders })
      ordersByUser.set(shop.user_id, list)
    }

    const cancelled = (r.cancelledOrders as string[] | undefined) ?? []
    if (cancelled.length > 0) {
      const list = cancelsByUser.get(shop.user_id) ?? []
      list.push({ marketplace: shop.marketplace, name: shop.name, lines: cancelled })
      cancelsByUser.set(shop.user_id, list)
    }
  }

  if (ordersByUser.size > 0 || cancelsByUser.size > 0) {
    const settingsRows = await db.select({
      user_id: userSettings.user_id,
      telegram_chat_id: userSettings.telegram_chat_id,
      notif_new_orders: userSettings.notif_new_orders,
      // The seller's chosen notification language. This alert used to be a
      // hardcoded Uzbek literal and was the only Telegram message that never
      // read it — so a Russian seller got Russian digests and Uzbek order
      // alerts, in the same chat.
      notif_lang: userSettings.notif_lang,
    }).from(userSettings)
      .where(and(
        isNotNull(userSettings.telegram_chat_id),
      ))

    for (const s of settingsRows) {
      if (!s.notif_new_orders || !s.telegram_chat_id) continue
      // A seller can have a cancellation with no new order on the same tick, so
      // this loop can no longer bail when the new-order list is empty. Default
      // to [] rather than leaving it possibly-undefined: the two messages below
      // are independent, and each must be able to send on its own.
      const shopOrders = ordersByUser.get(s.user_id) ?? []
      const shopCancelsList = cancelsByUser.get(s.user_id) ?? []
      if (shopOrders.length === 0 && shopCancelsList.length === 0) continue

      const total = shopOrders.reduce((sum, o) => sum + o.lines.length, 0)
      const buildMsg = (T: NotifStrings) => {
        const blocks = shopOrders.map(o => {
          const mpName = MP_LABEL[o.marketplace] ?? o.marketplace
          const detail = o.lines.slice(0, 10).map(l => `   ${l}`).join('\n')
          const more = o.lines.length > 10 ? `\n   ${T.newOrdersMore(o.lines.length - 10)}` : ''
          return `${T.newOrdersLine(mpName, o.lines.length)}\n${detail}${more}`
        }).join('\n')
        return `${T.newOrdersTitle(total)}\n${T.newOrdersSub}\n\n${blocks}\n\n${T.newOrdersCta}: https://daromadchi.uz/dashboard/orders`
      }

      if (shopOrders.length > 0) {
        await sendSellerMessageTo(s.telegram_chat_id, s.notif_lang, buildMsg)
      }

      // Cancellation notice, as a SEPARATE message rather than a section of
      // the one above. They are different events with opposite meanings — "go
      // and pack this" versus "do not" — and a seller skimming a phone
      // notification reads the first line. Folding a cancellation into a
      // «Новый заказ!» message is how it gets missed.
      const shopCancels = shopCancelsList
      if (shopCancels.length > 0) {
        const cancelTotal = shopCancels.reduce((sum, o) => sum + o.lines.length, 0)
        const buildCancelMsg = (T: NotifStrings) => {
          const blocks = shopCancels.map(o => {
            const mpName = MP_LABEL[o.marketplace] ?? o.marketplace
            const detail = o.lines.slice(0, 10).map(l => `   ${l}`).join('\n')
            const more = o.lines.length > 10 ? `\n   ${T.cancelledMore(o.lines.length - 10)}` : ''
            return `${T.cancelledLine(mpName, o.lines.length)}\n${detail}${more}`
          }).join('\n')
          return `${T.cancelledTitle(cancelTotal)}\n${T.cancelledSub}\n\n${blocks}\n\n${T.cancelledCta}: https://daromadchi.uz/dashboard/orders`
        }
        await sendSellerMessageTo(s.telegram_chat_id, s.notif_lang, buildCancelMsg)
      }
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

  return NextResponse.json({ ok: true, synced: results.length, heavy: heavyCount, stockRefreshed: stockCount, results })
})
