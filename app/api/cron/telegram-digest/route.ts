import { NextResponse } from 'next/server'
import { isNotNull, eq, ne, inArray, gte, lte } from 'drizzle-orm'
import { db, userSettings, shops as shopsTable, orders as ordersTable, products as productsTable } from '@/lib/db'
import { sendTelegramMessage } from '@/lib/telegram'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime     = 'nodejs'
export const maxDuration  = 120

const UZ_OFFSET_MIN = 5 * 60

interface SettingsRow {
  user_id:              string
  telegram_chat_id:     string
  notif_send_time:      string
  notif_send_days:      number[]
  alert_stock_threshold: number | null
}

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n))
}

export const GET = withErrorHandler(async (req: Request) => {
  const auth   = req.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!process.env.CRON_SECRET || bearer !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const nowUtcMin = new Date().getUTCHours() * 60 + new Date().getUTCMinutes()
  const uzMin     = (nowUtcMin + UZ_OFFSET_MIN) % (24 * 60)
  const uzHour    = Math.floor(uzMin / 60)
  const uzDay = new Date(Date.now() + UZ_OFFSET_MIN * 60_000).getUTCDay()

  const rows = await db.select({
    user_id: userSettings.user_id,
    telegram_chat_id: userSettings.telegram_chat_id,
    notif_send_time: userSettings.notif_send_time,
    notif_send_days: userSettings.notif_send_days,
    alert_stock_threshold: userSettings.alert_stock_threshold,
  }).from(userSettings)
    .where(isNotNull(userSettings.telegram_chat_id))

  const sent: { userId: string; parts: string[] }[] = []

  for (const s of rows as SettingsRow[]) {
    const sendTime = s.notif_send_time ?? '09:00'
    const sendHour = parseInt(sendTime.split(':')[0] ?? '9', 10)
    if (sendHour !== uzHour) continue

    const days = s.notif_send_days ?? [1, 2, 3, 4, 5, 6, 0]
    if (!days.includes(uzDay)) continue

    const isWeeklyDay = uzDay === 1
    const parts: string[] = []

    const shopRows = await db.select({ id: shopsTable.id }).from(shopsTable)
      .where(eq(shopsTable.user_id, s.user_id))
    const shopIds = shopRows
      .map(r => r.id)
    if (shopIds.length === 0) continue

    // ── Daily summary (yesterday's sales) ──
    {
      const day = await buildSalesSummary(shopIds, 1)
      if (day) parts.push(`📊 <b>Kunlik xulosa (kecha)</b>\n` + day)
    }

    // ── Weekly report (last 7 days, Mondays only) ──
    if (isWeeklyDay) {
      const week = await buildSalesSummary(shopIds, 7)
      if (week) parts.push(`📈 <b>Haftalik hisobot (7 kun)</b>\n` + week)
    }

    // ── Low-stock alerts ──
    {
      const threshold = s.alert_stock_threshold ?? 15
      const lowStock = await db.select({
        title: productsTable.title,
        stock_quantity: productsTable.stock_quantity,
      }).from(productsTable)
        .where(inArray(productsTable.shop_id, shopIds))
        .where(lte(productsTable.stock_quantity, threshold))
        .orderBy(productsTable.stock_quantity)
        .limit(10)

      if (lowStock.length > 0) {
        const lines = lowStock
          .map(p => `• ${p.title} — <b>${p.stock_quantity}</b> dona`)
          .join('\n')
        parts.push(`📦 <b>Kam zaxira (${lowStock.length})</b>\n${lines}`)
      }
    }

    if (parts.length === 0) continue

    const msg = parts.join('\n\n') + `\n\nTo'liq tahlil: https://daromadchi.uz/dashboard`
    await sendTelegramMessage(s.telegram_chat_id, msg)
    sent.push({ userId: s.user_id, parts: parts.map(p => p.split('\n')[0]) })
  }

  return NextResponse.json({ ok: true, uzHour, uzDay, sent: sent.length, details: sent })
})

async function buildSalesSummary(
  shopIds: string[],
  days: number,
): Promise<string | null> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const orderRows = await db.select({
    revenue: ordersTable.revenue,
  }).from(ordersTable)
    .where(inArray(ordersTable.shop_id, shopIds))
    .where(ne(ordersTable.status, 'cancelled'))
    .where(gte(ordersTable.ordered_at, since))

  if (orderRows.length === 0) {
    return `Buyurtmalar yo'q.`
  }

  const revenue = orderRows.reduce(
    (sum, o) => sum + Number(o.revenue ?? 0),
    0,
  )
  return `Buyurtmalar: <b>${orderRows.length}</b>\nTushum: <b>${fmt(revenue)} so'm</b>`
}
