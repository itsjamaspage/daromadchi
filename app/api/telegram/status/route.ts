import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { telegramConfigured } from '@/lib/telegram'

export interface NotifPrefs {
  lowStock: boolean
  dailySummary: boolean
  newOrders: boolean
  weeklyReport: boolean
  sendTime: string   // 'HH:MM'
  sendDays: number[] // 0=Sun … 6=Sat
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('user_settings')
    .select('telegram_chat_id, telegram_username, notif_low_stock, notif_daily_summary, notif_new_orders, notif_weekly_report, notif_send_time, notif_send_days')
    .eq('user_id', user.id)
    .maybeSingle()

  const prefs: NotifPrefs = {
    lowStock:     data?.notif_low_stock      ?? true,
    dailySummary: data?.notif_daily_summary  ?? true,
    newOrders:    data?.notif_new_orders     ?? false,
    weeklyReport: data?.notif_weekly_report  ?? false,
    sendTime:     data?.notif_send_time      ?? '09:00',
    sendDays:     data?.notif_send_days      ?? [1, 2, 3, 4, 5, 6, 0],
  }

  return NextResponse.json({
    configured: telegramConfigured(),
    linked:     !!data?.telegram_chat_id,
    username:   data?.telegram_username ?? null,
    prefs,
  })
}
