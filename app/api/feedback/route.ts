import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage, sendTelegramPhoto } from '@/lib/telegram'

const FEEDBACK_CHAT_IDS = ['6884517020']
const VALID_TYPES = ['bug', 'idea'] as const
const MAX_MSG_LEN = 2000
// ~5 MB image → base64 ≈ 6.7 MB string
const MAX_IMAGE_B64 = 7 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { type, message, image } = body

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'type: bug yoki idea bo\'lishi kerak' }, { status: 400 })
    }
    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'message talab etiladi' }, { status: 400 })
    }
    if (message.length > MAX_MSG_LEN) {
      return NextResponse.json({ error: `message maksimal ${MAX_MSG_LEN} belgi` }, { status: 400 })
    }
    if (image !== undefined && image !== null) {
      if (typeof image !== 'string' || !image.startsWith('data:image/')) {
        return NextResponse.json({ error: 'image format noto\'g\'ri' }, { status: 400 })
      }
      if (image.length > MAX_IMAGE_B64) {
        return NextResponse.json({ error: 'Rasm hajmi juda katta (max 5MB)' }, { status: 400 })
      }
    }

    const emoji = type === 'bug' ? '🐛' : '💡'
    const label = type === 'bug' ? 'Xato / Bug' : "G'oya / Idea"
    const text  = `${emoji} <b>Daromadchi Feedback</b>\n<b>Tur:</b> ${label}\n\n${message.trim()}`

    if (image && typeof image === 'string' && image.startsWith('data:image/')) {
      await Promise.all(FEEDBACK_CHAT_IDS.map(id => sendTelegramPhoto(id, image, text)))
    } else {
      await Promise.all(FEEDBACK_CHAT_IDS.map(id => sendTelegramMessage(id, text)))
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
