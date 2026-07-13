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

  await db.insert(userSettings).values({
    user_id:         user.id,
    notif_send_time: sendTime,
    notif_send_days: sendDays,
    updated_at:      new Date(),
  }).onConflictDoUpdate({
    target: userSettings.user_id,
    set: {
      notif_send_time: sendTime,
      notif_send_days: sendDays,
      updated_at:      new Date(),
    },
  })

  return NextResponse.json({ ok: true })
})
