import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { users, verificationTokens } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { withErrorHandler } from '@/lib/api-handler'
import { enforceLimit } from '@/lib/rate-limit'

const VerifySchema = z.object({
  email: z.string().email(),
  code:  z.string().length(6),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  // 10 code attempts per IP per 10 min. Brute-forcing the 6-digit space
  // (10^6 = 1M) at that cap takes 100k min ≈ 70 days per IP, and the code
  // TTL is minutes not months. Real users type it 1-2 times.
  const limited = enforceLimit(req, { key: 'auth:verify-email', max: 10, windowMs: 600_000 })
  if (limited) return limited

  const raw = await req.json().catch(() => null)
  const parsed = VerifySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Noto\'g\'ri ma\'lumot' }, { status: 400 })
  }

  const { email, code } = parsed.data
  const emailLower = email.toLowerCase()

  const token = await db.query.verificationTokens.findFirst({
    where: and(
      eq(verificationTokens.email, emailLower),
      eq(verificationTokens.token, code),
    ),
  })

  if (!token) {
    return NextResponse.json({ error: 'Kod noto\'g\'ri' }, { status: 400 })
  }

  if (new Date() > token.expires_at) {
    await db.delete(verificationTokens).where(eq(verificationTokens.token, code))
    return NextResponse.json({ error: 'Kod muddati tugagan. Yangi kod so\'rang.' }, { status: 400 })
  }

  await db.update(users)
    .set({ email_verified: new Date() })
    .where(eq(users.id, token.user_id))

  await db.delete(verificationTokens).where(eq(verificationTokens.email, emailLower))

  return NextResponse.json({ ok: true })
})
