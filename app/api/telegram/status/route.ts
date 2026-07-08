import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { db, userSettings } from '@/lib/db'
import { telegramConfigured } from '@/lib/telegram'
import { withErrorHandler } from '@/lib/api-handler'

export interface NotifPrefs {
  lowStock: boolean
  dailySummary: boolean
  newOrders: boolean
  weeklyReport: boolean
  sendTime: string
  sendDays: number[]
}

export const GET = withErrorHandler(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [data] = await db.select({
    telegram_chat_id: userSettings.telegram_chat_id,
    telegram_username: userSettings.telegram_username,
    notif_send_time: userSettings.notif_send_time,
    notif_send_days: userSettings.notif_send_days,
  }).from(userSettings)
    .where(eq(userSettings.user_id, user.id))

  const prefs: NotifPrefs = {
    lowStock:     true,
    dailySummary: true,
    newOrders:    false,
    weeklyReport: false,
    sendTime:     data?.notif_send_time ?? '09:00',
    sendDays:     data?.notif_send_days ?? [1, 2, 3, 4, 5, 6, 0],
  }

  return NextResponse.json({
    configured: telegramConfigured(),
    linked:     !!data?.telegram_chat_id,
    username:   data?.telegram_username ?? null,
    prefs,
  })
})
