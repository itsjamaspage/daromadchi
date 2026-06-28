import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler } from '@/lib/api-handler'

const SignupSchema = z.object({
  email:    z.string().email('Email noto\'g\'ri formatda'),
  password: z.string().min(6, 'Parol kamida 6 ta belgi bo\'lishi kerak').max(128),
  name:     z.string().max(100).optional(),
})

// 10 signup attempts per IP per hour
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
  const { email, password, name } = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name?.trim() ?? '' } },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    userId: data.user?.id ?? null,
    needsConfirmation: !data.session,
  })
})
