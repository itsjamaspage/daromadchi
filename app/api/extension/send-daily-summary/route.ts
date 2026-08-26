import { NextRequest, NextResponse } from 'next/server'
import { eq, and, inArray, gte, lte, asc } from 'drizzle-orm'
import { db, orders as ordersTable, products, userSettings } from '@/lib/db'
import { loadOrderInputs } from '@/lib/money/load-order-economics'
import { sumEconomics } from '@/lib/money/order-economics'
import { getExtensionUser, getShopIds, getUserPlan } from '@/lib/api/auth'
import { isInNotificationWindow } from '@/lib/telegram'
import { sendSellerMessageTo } from '@/lib/telegram-seller'
import { notifT, notifLocale } from '@/lib/notif-i18n'
import { withErrorHandler } from '@/lib/api-handler'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getExtensionUser(req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plan = await getUserPlan(user.id)
  if (plan === 'free') {
    return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 })
  }

  const [settings] = await db.select({
    telegram_chat_id: userSettings.telegram_chat_id,
    notif_send_time: userSettings.notif_send_time,
    notif_lang: userSettings.notif_lang,
  }).from(userSettings).where(eq(userSettings.user_id, user.id)).limit(1)

  if (!settings?.telegram_chat_id) {
    return NextResponse.json({ error: 'Telegram ulanmagan' }, { status: 400 })
  }

  // Only send if we're within ±30 min of the user's chosen notification window
  if (!isInNotificationWindow(settings.notif_send_time ?? null)) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'outside_window' })
  }

  const shopIds = await getShopIds(user.id)
  if (shopIds.length === 0) {
    return NextResponse.json({ error: 'Do\'kon topilmadi' }, { status: 400 })
  }

  const since24h = new Date(Date.now() - 86400000)

  const [orderRows, lowStockRows] = await Promise.all([
    // Counts only — the money comes from loadOrderInputs below.
    db.select({
      items_count: ordersTable.items_count,
      status: ordersTable.status,
    }).from(ordersTable).where(and(
      inArray(ordersTable.shop_id, shopIds),
      gte(ordersTable.ordered_at, since24h),
    )),
    db.select({
      title: products.title,
      stock_quantity: products.stock_quantity,
    }).from(products).where(and(
      inArray(products.shop_id, shopIds),
      lte(products.stock_quantity, 5),
    )).orderBy(asc(products.stock_quantity)).limit(5),
  ])

  const active   = orderRows.filter(o => o.status !== 'cancelled')
  const returned = orderRows.filter(o => o.status === 'returned')

  // Money goes through the shared rules — see lib/money/order-economics.ts.
  // This used to be `revenue − fee − delivery` over every non-cancelled order,
  // which was wrong twice: it counted sales that had not been delivered yet, it
  // subtracted no cost of goods at all, and a NULL fee (every Yandex order until
  // its netting report lands) read as a zero fee, so the "profit" it texted the
  // seller each morning was often just the revenue.
  const money = sumEconomics(await loadOrderInputs(shopIds, since24h, null))
  const revenue = money.revenue
  const profit  = money.net

  const T = notifT(settings.notif_lang)
  // Date locale follows the seller's language too — a Russian report dated in
  // uz-UZ format is the same mismatch one line smaller.
  const dateStr = new Date().toLocaleDateString(notifLocale(settings.notif_lang), { day: '2-digit', month: '2-digit', year: 'numeric' })

  const lines: string[] = [
    T.extDailyTitle(dateStr),
    ``,
    `${T.extRevenue}: <b>${fmt(revenue)}</b>`,
    `${T.extProfit}: <b>${fmt(profit)}</b>`,
    `${T.extOrders}: <b>${active.length}</b>`,
  ]

  if (returned.length > 0) lines.push(`${T.extReturned}: <b>${returned.length}</b>`)

  if (lowStockRows.length > 0) {
    lines.push(``, T.extLowStock)
    for (const p of lowStockRows) {
      lines.push(`• ${p.title}: ${p.stock_quantity} ${T.extUnit}`)
    }
  }

  lines.push(``, `<i>${T.extFooter}</i>`)

  const ok = await sendSellerMessageTo(settings.telegram_chat_id, settings.notif_lang, () => lines.join('\n'))
  return NextResponse.json({ ok })
})
