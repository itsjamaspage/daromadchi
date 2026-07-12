import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { users, verificationTokens } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { withErrorHandler } from '@/lib/api-handler'
import { sendVerificationCode } from '@/lib/email'

const ResendSchema = z.object({
  email: z.string().email(),
})

const resendRateMap = new Map<string, { count: number; resetAt: number }>()

function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'

  const now = Date.now()
  const entry = resendRateMap.get(ip)
  if (entry && now < entry.resetAt && entry.count >= 5) {
    return NextResponse.json(
      { error: 'Juda ko\'p so\'rov. Biroz kutib turing.' },
      { status: 429 },
    )
  }
  if (!entry || now > entry.resetAt) {
    resendRateMap.set(ip, { count: 1, resetAt: now + 600_000 })
  } else {
    entry.count++
  }

  const raw = await req.json().catch(() => null)
  const parsed = ResendSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Noto\'g\'ri ma\'lumot' }, { status: 400 })
  }

  const emailLower = parsed.data.email.toLowerCase()

  const user = await db.query.users.findFirst({
    where: eq(users.email, emailLower),
  })

  if (!user || user.email_verified) {
    return NextResponse.json({ ok: true })
  }

  const code = generateCode()
  await db.delete(verificationTokens).where(eq(verificationTokens.email, emailLower))
  await db.insert(verificationTokens).values({
    token: code,
    user_id: user.id,
    email: emailLower,
    expires_at: new Date(Date.now() + 10 * 60 * 1000),
  })

  await sendVerificationCode(emailLower, code)

  return NextResponse.json({ ok: true })
})
