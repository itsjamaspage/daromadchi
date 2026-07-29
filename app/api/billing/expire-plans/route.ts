import { NextRequest, NextResponse } from 'next/server'
import { and, ne, lt } from 'drizzle-orm'
import { db, users } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'

// Called by the cron job daily. Downgrades users whose plan_expires_at
// has passed. `plan` is a Postgres enum; the string cast at .set()
// matches the column shape in lib/db/schema.ts (planTypeEnum).
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth   = req.headers.get('authorization')
  const secret = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await db.update(users)
    .set({ plan: 'free', plan_expires_at: null })
    .where(and(
      ne(users.plan, 'free'),
      lt(users.plan_expires_at, new Date()),
    ))
    .returning({ id: users.id })

  return NextResponse.json({ ok: true, downgraded: rows.length })
})
