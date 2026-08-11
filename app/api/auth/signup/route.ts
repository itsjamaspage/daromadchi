import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { users, verificationTokens } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { withErrorHandler } from '@/lib/api-handler'
import { sendVerificationCode } from '@/lib/email'

const SignupSchema = z.object({
  email:    z.string().email('Email noto\'g\'ri formatda'),
  password: z.string().min(6, 'Parol kamida 6 ta belgi bo\'lishi kerak').max(128),
  name:     z.string().max(100).optional(),
  // Lawful-consent gate (ZRU-547): the client sends this only when the user
  // ticked the Privacy/Terms/Cookies checkbox. Enforced server-side below so
  // consent cannot be bypassed by calling the API directly.
  consent:  z.boolean().optional(),
})

const signupRateMap = new Map<string, { count: number; resetAt: number }>()
function checkSignupRate(ip: string): boolean {
  const now = Date.now()
  const entry = signupRateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    signupRateMap.set(ip, { count: 1, resetAt: now + 3_600_000 })
    if (signupRateMap.size > 5000) {
      for (const [k, v] of signupRateMap) {
        if (now > v.resetAt) { signupRateMap.delete(k); break }
      }
    }
    return false
  }
  entry.count++
  return entry.count > 10
}

function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'

  if (checkSignupRate(ip)) {
    return NextResponse.json(
      { error: "Bu IP manzildan juda ko'p hisob yaratildi. Bir soatdan so'ng urinib ko'ring." },
      { status: 429, headers: { 'Retry-After': '3600' } },
    )
  }

  const raw = await req.json().catch(() => null)
  const parsed = SignupSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Noto\'g\'ri ma\'lumot' }, { status: 400 })
  }
  const { email, password, name, consent } = parsed.data

  // Consent is mandatory for account creation (ZRU-547). The UI disables the
  // submit button until the box is ticked; this is the server-side backstop.
  if (consent !== true) {
    return NextResponse.json(
      { error: 'Davom etish uchun Maxfiylik siyosati, Foydalanish shartlari va Cookie siyosatiga rozilik bildiring.' },
      { status: 400 },
    )
  }

  const emailLower = email.toLowerCase()

  const existing = await db.query.users.findFirst({
    where: eq(users.email, emailLower),
  })

  if (existing) {
    return NextResponse.json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const [newUser] = await db.insert(users).values({
    email: emailLower,
    full_name: name?.trim() ?? null,
    password_hash: passwordHash,
    consented_at: new Date(),
  }).returning({ id: users.id })

  let needsVerification = false

  if (process.env.SMTP_USER) {
    try {
      const code = generateCode()
      await db.delete(verificationTokens).where(eq(verificationTokens.email, emailLower))
      await db.insert(verificationTokens).values({
        token: code,
        user_id: newUser!.id,
        email: emailLower,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
      })
      await sendVerificationCode(emailLower, code)
      needsVerification = true
    } catch (err) {
      console.error('[Verification] Failed to create/send verification:', err)
    }
  }

  return NextResponse.json({
    ok: true,
    userId: newUser?.id ?? null,
    needsVerification,
  })
})
