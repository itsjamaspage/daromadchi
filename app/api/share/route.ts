import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireAuth } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { userSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  const user = await requireAuth()
  const token = randomUUID()

  const existing = await db.query.userSettings.findFirst({
    where: eq(userSettings.user_id, user.id),
    columns: { id: true },
  })

  if (existing) {
    await db.update(userSettings)
      .set({ share_token: token, updated_at: new Date() })
      .where(eq(userSettings.user_id, user.id))
  } else {
    await db.insert(userSettings).values({ user_id: user.id, share_token: token })
  }

  return NextResponse.json({ ok: true, token })
}

export async function DELETE() {
  const user = await requireAuth()

  await db.update(userSettings)
    .set({ share_token: null, updated_at: new Date() })
    .where(eq(userSettings.user_id, user.id))

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const user = await requireAuth()

  const row = await db.query.userSettings.findFirst({
    where: eq(userSettings.user_id, user.id),
    columns: { share_token: true },
  })

  return NextResponse.json({ token: row?.share_token ?? null })
}
