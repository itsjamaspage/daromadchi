import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, userSettings } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'

// Two INDEPENDENT toggles for the cross-store stock-update notification:
//   inApp    → in-app pop-up (an `alerts` row) when stock is cross-updated
//   telegram → Telegram message when stock is cross-updated
// Both default ON. This route writes ONLY these two user_settings columns via
// onConflictDoUpdate, so a partial save never clobbers the other notif_* prefs.

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [row] = await db.select({
    inApp:    userSettings.notif_stock_update_inapp,
    telegram: userSettings.notif_stock_update_telegram,
  }).from(userSettings).where(eq(userSettings.user_id, user.id))

  return NextResponse.json({
    inApp:    row?.inApp ?? true,
    telegram: row?.telegram ?? true,
  })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const inApp    = typeof body.inApp    === 'boolean' ? body.inApp    : true
  const telegram = typeof body.telegram === 'boolean' ? body.telegram : true

  await db.insert(userSettings).values({
    user_id:                     user.id,
    notif_stock_update_inapp:    inApp,
    notif_stock_update_telegram: telegram,
    updated_at:                  new Date(),
  }).onConflictDoUpdate({
    target: userSettings.user_id,
    set: {
      notif_stock_update_inapp:    inApp,
      notif_stock_update_telegram: telegram,
      updated_at:                  new Date(),
    },
  })

  return NextResponse.json({ ok: true, inApp, telegram })
})
