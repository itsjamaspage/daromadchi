import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getAuthUser } from '@/lib/api/auth'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getAuthUser(req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('user_settings')
    .select('telegram_chat_id, telegram_username')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    linked:   !!data?.telegram_chat_id,
    username: data?.telegram_username ?? null,
  })
})
