import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db, userSettings } from '@/lib/db'
import type { NotifPrefs } from '../status/route'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Partial<NotifPrefs>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const sendTime = typeof body.sendTime === 'string' && /^\d{2}:\d{2}$/.test(body.sendTime)
    ? body.sendTime : '09:00'
  const sendDays = Array.isArray(body.sendDays)
    ? [...new Set(body.sendDays.filter(n => Number.isInteger(n) && n >= 0 && n <= 6))]
    : [1, 2, 3, 4, 5, 6, 0]

  const lowStock     = typeof body.lowStock === 'boolean' ? body.lowStock : true
  const dailySummary = typeof body.dailySummary === 'boolean' ? body.dailySummary : true
  const newOrders    = typeof body.newOrders === 'boolean' ? body.newOrders : false
  const weeklyReport = typeof body.weeklyReport === 'boolean' ? body.weeklyReport : false

  await db.insert(userSettings).values({
    user_id:              user.id,
    notif_low_stock:      lowStock,
    notif_daily_summary:  dailySummary,
    notif_new_orders:     newOrders,
    notif_weekly_report:  weeklyReport,
    notif_send_time:      sendTime,
    notif_send_days:      sendDays,
    updated_at:           new Date(),
  }).onConflictDoUpdate({
    target: userSettings.user_id,
    set: {
      notif_low_stock:     lowStock,
      notif_daily_summary: dailySummary,
      notif_new_orders:    newOrders,
      notif_weekly_report: weeklyReport,
      notif_send_time:     sendTime,
      notif_send_days:     sendDays,
      updated_at:          new Date(),
    },
  })

  return NextResponse.json({ ok: true })
})
