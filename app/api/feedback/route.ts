import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'

const FEEDBACK_CHAT_IDS = ['6884517020']

export async function POST(req: NextRequest) {
  try {
    const { type, message } = await req.json()
    if (!type || !message?.trim()) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const emoji = type === 'bug' ? '🐛' : '💡'
    const label = type === 'bug' ? 'Xato / Bug' : "G'oya / Idea"
    const text = `${emoji} <b>Daromadchi Feedback</b>\n<b>Tur:</b> ${label}\n\n${message.trim()}`

    await Promise.all(FEEDBACK_CHAT_IDS.map(id => sendTelegramMessage(id, text)))

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
