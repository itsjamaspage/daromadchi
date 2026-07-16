export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
    if (!BOT_TOKEN) return

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '')
    if (!appUrl) return

    const webhookUrl = `${appUrl}/api/telegram/webhook`
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET

    try {
      const infoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`)
      const info = await infoRes.json()

      if (info.result?.url === webhookUrl) return

      const params = new URLSearchParams({
        url: webhookUrl,
        allowed_updates: JSON.stringify(['message', 'callback_query']),
      })
      if (secret) params.set('secret_token', secret)

      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?${params}`)
      const result = await res.json()
      console.log('[telegram] webhook registered:', result.ok ? webhookUrl : result)
    } catch (err) {
      console.error('[telegram] webhook registration failed:', err)
    }
  }
}
