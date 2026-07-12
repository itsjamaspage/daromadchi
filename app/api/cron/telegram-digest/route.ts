import { NextResponse } from 'next/server'
import { isNotNull, eq, ne, and, inArray, gte } from 'drizzle-orm'
import { db, userSettings, shops as shopsTable, orders as ordersTable } from '@/lib/db'
import { computeStockGroups, lowStockGroups } from '@/lib/db/stock-groups'
import { sendTelegramMessage } from '@/lib/telegram'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime     = 'nodejs'
export const maxDuration  = 120

const UZ_OFFSET_MIN = 5 * 60

const MP_SHORT = { uzum: 'UZ', wildberries: 'WB', yandex_market: 'YM' } as const

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

    // ── Low-stock alerts (total leftover across all marketplaces) ──
    {
      const threshold = s.alert_stock_threshold ?? 15
      try {
        const groups = await computeStockGroups(s.user_id, shopIds)
        const low = lowStockGroups(groups, threshold).slice(0, 10)
        if (low.length > 0) {
          const lines = low.map(g => {
            const perMp = (['uzum', 'wildberries', 'yandex_market'] as const)
              .filter(mp => mp in g.stock_by_marketplace)
              .map(mp => `${MP_SHORT[mp]} ${g.stock_by_marketplace[mp]}`)
              .join(' · ')
            const days = g.days_of_stock !== null ? `, ~${g.days_of_stock} kun` : ''
            return `• ${g.title} — jami <b>${g.leftover}</b> dona${perMp ? ` (${perMp})` : ''}${days}`
          }).join('\n')
          parts.push(`📦 <b>Kam zaxira (${low.length})</b>\n${lines}\nYangi partiya buyurtma qiling yoki reklamani to'xtating.`)
        }
      } catch { /* leftover alerts are best-effort */ }
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
    .where(and(
      inArray(ordersTable.shop_id, shopIds),
      ne(ordersTable.status, 'cancelled'),
      gte(ordersTable.ordered_at, since),
    ))

  if (orderRows.length === 0) {
    return `Buyurtmalar yo'q.`
  }

  const revenue = orderRows.reduce(
    (sum: number, o: { revenue: string | null }) => sum + Number(o.revenue ?? 0),
    0,
  )
  return `Buyurtmalar: <b>${orderRows.length}</b>\nTushum: <b>${fmt(revenue)} so'm</b>`
}
