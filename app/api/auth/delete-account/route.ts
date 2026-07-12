import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { emails } = await req.json()
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'No emails provided' }, { status: 400 })
  }

  const result = await db.delete(users).where(
    inArray(users.email, emails.map((e: string) => e.toLowerCase()))
  ).returning({ id: users.id, email: users.email })

  return NextResponse.json({ deleted: result })
})
