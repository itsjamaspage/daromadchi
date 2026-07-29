import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, extActivationCodes } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'
import { enforceLimit } from '@/lib/rate-limit'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHANNEL   = '@daromadchi_uz'

// POST /api/extension/activate
// Body: { code: string }
// Returns: { ok: true } or { ok: false, error: string }
export const POST = withErrorHandler(async (req: NextRequest) => {
  const limited = enforceLimit(req, { key: 'extension:activate', max: 10, windowMs: 15 * 60 * 1000 })
  if (limited) return limited

  try {
    const { code } = await req.json()
    if (!code?.trim()) return NextResponse.json({ ok: false, error: 'Kod kiritilmadi' }, { status: 400 })

    const normalized = code.trim().toUpperCase()

    const [row] = await db.select({
      chat_id:    extActivationCodes.chat_id,
      used:       extActivationCodes.used,
      expires_at: extActivationCodes.expires_at,
    }).from(extActivationCodes)
      .where(eq(extActivationCodes.code, normalized))
      .limit(1)

    if (!row)              return NextResponse.json({ ok: false, error: 'Kod topilmadi yoki noto\'g\'ri' }, { status: 404 })
    if (row.used)          return NextResponse.json({ ok: false, error: 'Kod allaqachon ishlatilgan' }, { status: 400 })
    if (row.expires_at < new Date()) return NextResponse.json({ ok: false, error: 'Kod muddati tugagan. Qayta /activate yuboring' }, { status: 400 })

    const member = await checkMembership(row.chat_id)
    if (!member) return NextResponse.json({ ok: false, error: `@daromadchi_uz kanaliga a'zo bo'lmadingiz` }, { status: 403 })

    await db.update(extActivationCodes)
      .set({ used: true })
      .where(eq(extActivationCodes.code, normalized))

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatosi' }, { status: 500 })
  }
})

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
