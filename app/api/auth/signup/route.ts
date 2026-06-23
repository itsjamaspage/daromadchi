import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'

  if (checkSignupRate(ip)) {
    return NextResponse.json(
      { error: "Bu IP manzildan juda ko'p hisob yaratildi. Bir soatdan so'ng urinib ko'ring." },
      { status: 429, headers: { 'Retry-After': '3600' } },
    )
  }

  const body = await req.json().catch(() => null)
  if (!body?.email || typeof body.email !== 'string') {
    return NextResponse.json({ error: 'Email talab etiladi' }, { status: 400 })
  }
  if (!body?.password || typeof body.password !== 'string' || body.password.length < 6) {
    return NextResponse.json({ error: "Parol kamida 6 ta belgi bo'lishi kerak" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: body.email,
    password: body.password,
    options: { data: { full_name: typeof body.name === 'string' ? body.name.trim() : '' } },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    userId: data.user?.id ?? null,
    needsConfirmation: !data.session,
  })
}
