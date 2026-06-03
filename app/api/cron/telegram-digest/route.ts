import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTelegramMessage } from '@/lib/telegram'

export const runtime     = 'nodejs'
export const maxDuration  = 120

// Runs hourly (see vercel.json). Sends each linked user their daily summary /
// weekly report / low-stock digest when the current Uzbekistan time matches the
// hour they chose and today is one of their selected days.
//
// Uzbekistan is UTC+5 (no DST).
const UZ_OFFSET_MIN = 5 * 60

interface SettingsRow {
  user_id:              string
  telegram_chat_id:     string
  notif_low_stock:      boolean
  notif_daily_summary:  boolean
  notif_new_orders:     boolean
  notif_weekly_report:  boolean
  notif_send_time:      string | null
  notif_send_days:      number[] | null
  alert_stock_threshold: number | null
}

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n))
}

export async function GET(req: Request) {
  // Vercel Cron sends: Authorization: Bearer {CRON_SECRET}
  const auth   = req.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (process.env.CRON_SECRET && bearer !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  // Current Uzbekistan local time
  const nowUtcMin = new Date().getUTCHours() * 60 + new Date().getUTCMinutes()
  const uzMin     = (nowUtcMin + UZ_OFFSET_MIN) % (24 * 60)
  const uzHour    = Math.floor(uzMin / 60)
  // Day-of-week in UZ time (0=Sun … 6=Sat)
  const uzDay = new Date(Date.now() + UZ_OFFSET_MIN * 60_000).getUTCDay()

  const supabase = createAdminClient()
  const { data: rows, error } = await supabase
    .from('user_settings')
    .select('user_id, telegram_chat_id, notif_low_stock, notif_daily_summary, notif_new_orders, notif_weekly_report, notif_send_time, notif_send_days, alert_stock_threshold')
    .not('telegram_chat_id', 'is', null)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const sent: { userId: string; parts: string[] }[] = []

  for (const s of (rows ?? []) as SettingsRow[]) {
    // Match the chosen hour
    const sendTime = s.notif_send_time ?? '09:00'
    const sendHour = parseInt(sendTime.split(':')[0] ?? '9', 10)
    if (sendHour !== uzHour) continue

    // Match the chosen day
    const days = s.notif_send_days ?? [1, 2, 3, 4, 5, 6, 0]
    if (!days.includes(uzDay)) continue

    // Weekly report only fires on Mondays
    const isWeeklyDay = uzDay === 1

    const parts: string[] = []

    // Resolve user's shops once
    const { data: shopRows } = await supabase
      .from('shops')
      .select('id')
      .eq('user_id', s.user_id)
    const shopIds = (shopRows ?? []).map((r: { id: string }) => r.id)
    if (shopIds.length === 0) continue

    // ── Daily summary (yesterday's sales) ──
    if (s.notif_daily_summary) {
      const day = await buildSalesSummary(supabase, shopIds, 1)
      if (day) parts.push(`📊 <b>Kunlik xulosa (kecha)</b>\n` + day)
    }

    // ── Weekly report (last 7 days, Mondays only) ──
    if (s.notif_weekly_report && isWeeklyDay) {
      const week = await buildSalesSummary(supabase, shopIds, 7)
      if (week) parts.push(`📈 <b>Haftalik hisobot (7 kun)</b>\n` + week)
    }

    // ── Low-stock alerts ──
    if (s.notif_low_stock) {
      const threshold = s.alert_stock_threshold ?? 15
      const { data: lowStock } = await supabase
        .from('products')
        .select('title, stock_quantity')
        .in('shop_id', shopIds)
        .lte('stock_quantity', threshold)
        .order('stock_quantity', { ascending: true })
        .limit(10)

      if (lowStock && lowStock.length > 0) {
        const lines = lowStock
          .map((p: { title: string; stock_quantity: number }) => `• ${p.title} — <b>${p.stock_quantity}</b> dona`)
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
}

// Aggregates revenue + order count over the last `days` days for the given shops.
async function buildSalesSummary(
  supabase: ReturnType<typeof createAdminClient>,
  shopIds: string[],
  days: number,
): Promise<string | null> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data: orders } = await supabase
    .from('orders')
    .select('revenue')
    .in('shop_id', shopIds)
    .gte('ordered_at', since.toISOString())

  if (!orders || orders.length === 0) {
    return `Buyurtmalar yo'q.`
  }

  const revenue = orders.reduce(
    (sum: number, o: { revenue: number | null }) => sum + Number(o.revenue ?? 0),
    0,
  )
  return `Buyurtmalar: <b>${orders.length}</b>\nTushum: <b>${fmt(revenue)} so'm</b>`
}
