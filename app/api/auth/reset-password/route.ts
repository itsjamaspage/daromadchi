import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { db, users, passwordResetTokens } from '@/lib/db'
import { sendPasswordResetLink } from '@/lib/email'
import { withErrorHandler } from '@/lib/api-handler'
import { enforceLimit } from '@/lib/rate-limit'

const Schema = z.object({
  email: z.string().email('Email noto\'g\'ri formatda'),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  // 3 reset requests per IP per hour — real users hit this at most a couple
  // of times on a bad day; a scraper spamming this would just flood our SMTP
  // quota with mail to real (but uninvolved) users.
  const limited = enforceLimit(req, { key: 'auth:reset-password', max: 3, windowMs: 3_600_000 })
  if (limited) return limited

  const raw = await req.json().catch(() => null)
  const parsed = Schema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 })
  }

  const email = parsed.data.email.toLowerCase().trim()

  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  // Always return 200 even when the email doesn't exist — otherwise the
  // endpoint becomes a "does this email have an account" oracle. Real user
  // gets the email; attacker enumerating emails learns nothing.
  if (!user) return NextResponse.json({ ok: true })

  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1h

  await db.insert(passwordResetTokens).values({
    token,
    user_id: user.id,
    email,
    expires_at: expiresAt,
  })

  const origin = process.env.NEXT_PUBLIC_SITE_URL
    ?? new URL(req.url).origin
    ?? 'https://daromadchi.uz'
  const url = `${origin}/auth/reset?token=${encodeURIComponent(token)}`

  try {
    await sendPasswordResetLink(email, url)
  } catch (err) {
    console.error('[reset-password] sendPasswordResetLink failed', err)
    // Still return 200 so the endpoint isn't a probe for SMTP failures;
    // the sweeper of expired tokens keeps the table bounded.
  }

  return NextResponse.json({ ok: true })
})
