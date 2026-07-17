import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, alerts, userSettings } from '@/lib/db'
import { getExtensionUser, getUserPlan } from '@/lib/api/auth'
import { sendTelegramMessage } from '@/lib/telegram'
import { withErrorHandler } from '@/lib/api-handler'

interface AlertInput {
  type:      string
  message:   string
  priority?: string
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getExtensionUser(req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plan = await getUserPlan(user.id)
  if (plan === 'free') {
    return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!Array.isArray(body?.alerts) || body.alerts.length === 0) {
    return NextResponse.json({ error: 'alerts massivi talab etiladi' }, { status: 400 })
  }

  const { shopId, alerts: alertInputs }: { shopId?: string; alerts: AlertInput[] } = body

  const rows = alertInputs.map(a => ({
    user_id:  user.id,
    shop_id:  shopId ? Number(shopId) : null,
    type:     String(a.type    || 'unknown'),
    message:  String(a.message || ''),
  }))

  await db.insert(alerts).values(rows)

  const [settings] = await db.select({ telegram_chat_id: userSettings.telegram_chat_id })
    .from(userSettings)
    .where(eq(userSettings.user_id, user.id))

  let sent = 0
  if (settings?.telegram_chat_id) {
    for (const a of alertInputs) {
      const ok = await sendTelegramMessage(settings.telegram_chat_id, a.message)
      if (ok) sent++
    }
  }

  return NextResponse.json({ ok: true, stored: rows.length, sent })
})
