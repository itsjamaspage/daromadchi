import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, supabaseAdmin } from '@/lib/api/auth'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.slice(7)
  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token topilmadi' }, { status: 401 })
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) {
    return NextResponse.json({ valid: false, error: 'Token yaroqsiz yoki muddati tugagan' }, { status: 401 })
  }

  const plan = await getUserPlan(user.id)

  return NextResponse.json({ valid: true, email: user.email, userId: user.id, plan })
}
