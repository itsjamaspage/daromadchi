import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not set' })
  }

  const infoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`)
  const info = await infoRes.json()

  return NextResponse.json({ ok: true, webhook: info.result })
})

export const POST = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not set' })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'https://daromadchi.uz'
  const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/telegram/webhook`

  const params = new URLSearchParams({
    url: webhookUrl,
    allowed_updates: JSON.stringify(['message', 'callback_query']),
  })

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret) params.set('secret_token', secret)

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?${params}`)
  const result = await res.json()

  return NextResponse.json({ ok: result.ok, webhookUrl, result })
})
