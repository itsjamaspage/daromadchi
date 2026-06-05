import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHANNEL   = '@daromadchi_uz'

// POST /api/extension/activate
// Body: { code: string }
// Returns: { ok: true } or { ok: false, error: string }
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()
    if (!code?.trim()) return NextResponse.json({ ok: false, error: 'Kod kiritilmadi' }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('ext_activation_codes')
      .select('chat_id, used, expires_at')
      .eq('code', code.trim().toUpperCase())
      .single()

    if (error || !data) return NextResponse.json({ ok: false, error: 'Kod topilmadi yoki noto\'g\'ri' }, { status: 404 })
    if (data.used)       return NextResponse.json({ ok: false, error: 'Kod allaqachon ishlatilgan' }, { status: 400 })
    if (new Date(data.expires_at) < new Date()) return NextResponse.json({ ok: false, error: 'Kod muddati tugagan. Qayta /activate yuboring' }, { status: 400 })

    // Double-check channel membership at activation time
    const member = await checkMembership(data.chat_id)
    if (!member) return NextResponse.json({ ok: false, error: `@daromadchi_uz kanaliga a'zo bo'lmadingiz` }, { status: 403 })

    // Mark code as used
    await supabase.from('ext_activation_codes').update({ used: true }).eq('code', code.trim().toUpperCase())

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatosi' }, { status: 500 })
  }
}

async function checkMembership(chatId: string): Promise<boolean> {
  if (!BOT_TOKEN) return true // dev fallback
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHANNEL, user_id: parseInt(chatId) }),
    })
    const data = await res.json()
    const status = data?.result?.status
    return ['member', 'administrator', 'creator'].includes(status)
  } catch {
    return false
  }
}
