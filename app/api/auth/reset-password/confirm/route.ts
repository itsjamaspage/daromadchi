import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { and, eq, isNull, gt } from 'drizzle-orm'
import { db, users, passwordResetTokens } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { enforceLimit } from '@/lib/rate-limit'

const Schema = z.object({
  token:    z.string().min(20).max(200),
  password: z.string().min(6).max(200),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  // Tokens are 256-bit random (~43 base64url chars); brute force isn't a
  // realistic threat. Cap per-IP to shut down a bot POSTing garbage tokens
  // in a tight loop, not because the guess would ever succeed.
  const limited = enforceLimit(req, { key: 'auth:reset-password-confirm', max: 20, windowMs: 600_000 })
  if (limited) return limited

  const raw = await req.json().catch(() => null)
  const parsed = Schema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 })
  }

  const { token, password } = parsed.data

  const [row] = await db.select({
    token:      passwordResetTokens.token,
    user_id:    passwordResetTokens.user_id,
    email:      passwordResetTokens.email,
    expires_at: passwordResetTokens.expires_at,
    used_at:    passwordResetTokens.used_at,
  }).from(passwordResetTokens)
    .where(and(
      eq(passwordResetTokens.token, token),
      isNull(passwordResetTokens.used_at),
      gt(passwordResetTokens.expires_at, new Date()),
    ))
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: 'Havola noto\'g\'ri yoki muddati o\'tgan' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  // Mark the token used first — if the password update itself fails, we've
  // still burned the token, which is the safer failure mode (worst case:
  // user requests a new one).
  await db.update(passwordResetTokens)
    .set({ used_at: new Date() })
    .where(eq(passwordResetTokens.token, token))

  await db.update(users)
    .set({ password_hash: passwordHash })
    .where(eq(users.id, row.user_id))

  return NextResponse.json({ ok: true })
})
