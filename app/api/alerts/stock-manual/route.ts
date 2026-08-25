import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, userSettings } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'

// One dedicated toggle for the read-only "update your stock manually" reminder
// (lib/marketplace/manual-stock-notify.ts). Governs both channels (Telegram +
// in-app), default ON, independent of the edit-mode notif_stock_update_* toggles.
// Writes ONLY this column via onConflictDoUpdate, so a partial save never
// clobbers the other notif_* prefs.

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [row] = await db.select({ enabled: userSettings.notif_stock_manual })
    .from(userSettings).where(eq(userSettings.user_id, user.id))

  return NextResponse.json({ enabled: row?.enabled ?? true })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const enabled = typeof body.enabled === 'boolean' ? body.enabled : true

  await db.insert(userSettings).values({
    user_id:            user.id,
    notif_stock_manual: enabled,
    updated_at:         new Date(),
  }).onConflictDoUpdate({
    target: userSettings.user_id,
    set: { notif_stock_manual: enabled, updated_at: new Date() },
  })

  return NextResponse.json({ ok: true, enabled })
})
