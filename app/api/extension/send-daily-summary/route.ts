import { NextRequest, NextResponse } from 'next/server'
import { eq, and, inArray, gte, lte, asc } from 'drizzle-orm'
import { db, orders as ordersTable, products, userSettings } from '@/lib/db'
import { getExtensionUser, getShopIds, getUserPlan } from '@/lib/api/auth'
import { sendTelegramMessage, isInNotificationWindow } from '@/lib/telegram'
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
    db.select({
      revenue: ordersTable.revenue,
      marketplace_fee: ordersTable.marketplace_fee,
      delivery_cost: ordersTable.delivery_cost,
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

  const revenue    = active.reduce((s, o) => s + Number(o.revenue         ?? 0), 0)
  const commission = active.reduce((s, o) => s + Number(o.marketplace_fee ?? 0), 0)
  const delivery   = active.reduce((s, o) => s + Number(o.delivery_cost   ?? 0), 0)
  const profit     = revenue - commission - delivery

  const dateStr = new Date().toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const lines: string[] = [
    `📊 <b>Kunlik hisobot — ${dateStr}</b>`,
    ``,
    `💰 Daromad: <b>${fmt(revenue)}</b>`,
    `📈 Sof foyda: <b>${fmt(profit)}</b>`,
    `🛒 Buyurtmalar: <b>${active.length}</b>`,
  ]

  if (returned.length > 0) lines.push(`↩️ Qaytarilgan: <b>${returned.length}</b>`)

  if (lowStockRows.length > 0) {
    lines.push(``, `⚠️ <b>Kam zaxira:</b>`)
    for (const p of lowStockRows) {
      lines.push(`• ${p.title}: ${p.stock_quantity} dona`)
    }
  }

  lines.push(``, `<i>daromadchi.uz da to'liq tahlil</i>`)

  const ok = await sendTelegramMessage(settings.telegram_chat_id, lines.join('\n'))
  return NextResponse.json({ ok })
})
