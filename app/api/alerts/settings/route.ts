import { NextRequest, NextResponse } from 'next/server'
import { saveAlertSettings } from '@/lib/db/alerts'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })

    const { stockThreshold, telegramBotToken, telegramChatId } = body

    if (typeof stockThreshold !== 'number' || !isFinite(stockThreshold) || stockThreshold < 1 || stockThreshold > 10000) {
      return NextResponse.json({ ok: false, error: 'stockThreshold: 1–10000 orasida bo\'lishi kerak' }, { status: 400 })
    }
    if (typeof telegramBotToken !== 'string' || telegramBotToken.length > 500) {
      return NextResponse.json({ ok: false, error: 'telegramBotToken noto\'g\'ri' }, { status: 400 })
    }
    if (typeof telegramChatId !== 'string' || telegramChatId.length > 200) {
      return NextResponse.json({ ok: false, error: 'telegramChatId noto\'g\'ri' }, { status: 400 })
    }

    await saveAlertSettings({ stockThreshold, telegramBotToken, telegramChatId })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatosi' }, { status: 500 })
  }
}
