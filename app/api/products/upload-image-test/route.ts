import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'

const IMGBB_API_KEY = process.env.IMGBB_API_KEY

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const checks: Record<string, string> = {}

  checks.apiKeySet = IMGBB_API_KEY ? 'yes' : 'NO — IMGBB_API_KEY is missing'
  checks.apiKeyLength = IMGBB_API_KEY ? `${IMGBB_API_KEY.length} chars` : '0'

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 10_000)
  try {
    const res = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ key: IMGBB_API_KEY || 'test' }),
      signal: ac.signal,
    })
    clearTimeout(timer)
    const text = await res.text()
    checks.imgbbReachable = 'yes'
    checks.imgbbStatus = String(res.status)
    try {
      const parsed = JSON.parse(text)
      checks.imgbbResponse = parsed?.error?.message || parsed?.status_txt || 'ok'
    } catch {
      checks.imgbbResponse = text.slice(0, 200)
    }
  } catch (e) {
    clearTimeout(timer)
    checks.imgbbReachable = 'NO'
    checks.imgbbError = (e as Error).name === 'AbortError'
      ? 'timed out after 10s'
      : (e as Error).message
  }

  return NextResponse.json(checks)
})
