import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, userSettings } from '@/lib/db'
import { sendTelegramMessage } from '@/lib/telegram'
import { withErrorHandler } from '@/lib/api-handler'
import { notifT } from '@/lib/notif-i18n'
import { buildDigestForUser } from '@/lib/telegram-digest'

// Sends the digest immediately to the current user, bypassing the scheduled
// time window. Lets the user verify that notifications arrive and what they
// look like. Always sends something (a test header) even when there is no data.
export const POST = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [settings] = await db.select({
    telegram_chat_id: userSettings.telegram_chat_id,
    notif_low_stock: userSettings.notif_low_stock,
    notif_daily_summary: userSettings.notif_daily_summary,
    notif_weekly_report: userSettings.notif_weekly_report,
    notif_lang: userSettings.notif_lang,
    alert_stock_threshold: userSettings.alert_stock_threshold,
  }).from(userSettings)
    .where(eq(userSettings.user_id, user.id))

  if (!settings?.telegram_chat_id) {
    return NextResponse.json({ ok: false, error: 'telegram_not_linked' }, { status: 400 })
  }

  const t = notifT(settings.notif_lang)

  const digest = await buildDigestForUser({
    user_id: user.id,
    notif_low_stock: settings.notif_low_stock,
    notif_daily_summary: settings.notif_daily_summary,
    notif_weekly_report: settings.notif_weekly_report,
    notif_lang: settings.notif_lang,
    alert_stock_threshold: settings.alert_stock_threshold,
  }, true)

  const body = digest
    ? `${t.testHeader}\n\n${digest.text}`
    : `${t.testHeader}\n\n${t.noOrders}\n\n${t.testFooter}`

  const ok = await sendTelegramMessage(settings.telegram_chat_id, body)
  return NextResponse.json({ ok })
})
