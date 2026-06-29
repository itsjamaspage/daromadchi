import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { NotifPrefs } from '../status/route'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Partial<NotifPrefs>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  // Sanitise sendTime to HH:MM and sendDays to valid 0-6 ints
  const sendTime = typeof body.sendTime === 'string' && /^\d{2}:\d{2}$/.test(body.sendTime)
    ? body.sendTime : '09:00'
  const sendDays = Array.isArray(body.sendDays)
    ? [...new Set(body.sendDays.filter(n => Number.isInteger(n) && n >= 0 && n <= 6))]
    : [1, 2, 3, 4, 5, 6, 0]

  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id:              user.id,
      notif_low_stock:      !!body.lowStock,
      notif_daily_summary:  !!body.dailySummary,
      notif_new_orders:     !!body.newOrders,
      notif_weekly_report:  !!body.weeklyReport,
      notif_send_time:      sendTime,
      notif_send_days:      sendDays,
      updated_at:           new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
})
