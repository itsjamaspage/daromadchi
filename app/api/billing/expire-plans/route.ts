import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/api/auth'

// Called by Vercel Cron daily at 01:00 UTC.
// Downgrades users whose plan_expires_at has passed.
export async function GET(req: NextRequest) {
  // Vercel Cron sends: Authorization: Bearer {CRON_SECRET}
  const auth   = req.headers.get('authorization')
  const secret = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ plan: 'free', plan_expires_at: null })
    .neq('plan', 'free')
    .lt('plan_expires_at', new Date().toISOString())
    .select('id')

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, downgraded: data?.length ?? 0 })
}
