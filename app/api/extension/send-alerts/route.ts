import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getAuthUser, getUserPlan } from '@/lib/api/auth'
import { sendTelegramMessage } from '@/lib/telegram'
import { withErrorHandler } from '@/lib/api-handler'

interface AlertInput {
  type:      string
  message:   string
  priority?: string
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getAuthUser(req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plan = await getUserPlan(user.id)
  if (plan === 'free') {
    return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!Array.isArray(body?.alerts) || body.alerts.length === 0) {
    return NextResponse.json({ error: 'alerts massivi talab etiladi' }, { status: 400 })
  }

  const { shopId, alerts }: { shopId?: string; alerts: AlertInput[] } = body

  const rows = alerts.map(a => ({
    user_id:  user.id,
    shop_id:  shopId ?? null,
    type:     String(a.type    || 'unknown'),
    message:  String(a.message || ''),
    priority: String(a.priority || 'warning'),
  }))

  await supabaseAdmin.from('alerts').insert(rows)

  const { data: settings } = await supabaseAdmin
    .from('user_settings')
    .select('telegram_chat_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let sent = 0
  if (settings?.telegram_chat_id) {
    for (const a of alerts) {
      const ok = await sendTelegramMessage(settings.telegram_chat_id, a.message)
      if (ok) sent++
    }
  }

  return NextResponse.json({ ok: true, stored: rows.length, sent })
})
