import { NextResponse } from 'next/server'
import { isNotNull } from 'drizzle-orm'
import { db, userSettings } from '@/lib/db'
import { sendTelegramMessage } from '@/lib/telegram'
import { withErrorHandler } from '@/lib/api-handler'
import { buildDigestForUser } from '@/lib/telegram-digest'

export const runtime     = 'nodejs'
export const maxDuration  = 120

const UZ_OFFSET_MIN = 5 * 60

interface SettingsRow {
  user_id:              string
  telegram_chat_id:     string
  notif_low_stock:      boolean
  notif_daily_summary:  boolean
  notif_weekly_report:  boolean
  notif_send_time:      string
  notif_send_days:      number[]
  notif_lang:           string | null
  alert_stock_threshold: number | null
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
    notif_low_stock: userSettings.notif_low_stock,
    notif_daily_summary: userSettings.notif_daily_summary,
    notif_weekly_report: userSettings.notif_weekly_report,
    notif_send_time: userSettings.notif_send_time,
    notif_send_days: userSettings.notif_send_days,
    notif_lang: userSettings.notif_lang,
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

    const msg = await buildDigestForUser(s, uzDay === 1)
    if (!msg) continue

    await sendTelegramMessage(s.telegram_chat_id, msg.text)
    sent.push({ userId: s.user_id, parts: msg.headers })
  }

  return NextResponse.json({ ok: true, uzHour, uzDay, sent: sent.length, details: sent })
})
