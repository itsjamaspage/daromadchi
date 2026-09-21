import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'

const IMGBB_API_KEY = process.env.IMGBB_API_KEY
const UPLOAD_TIMEOUT_MS = 30_000

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!IMGBB_API_KEY) {
    return NextResponse.json({ error: 'Image upload not configured (IMGBB_API_KEY missing)' }, { status: 500 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch (e) {
    return NextResponse.json({ error: `Failed to parse form data: ${(e as Error).message}` }, { status: 400 })
  }

  const file = formData.get('image') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  const maxSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')

  const body = new FormData()
  body.append('key', IMGBB_API_KEY)
  body.append('image', base64)
  body.append('name', file.name.replace(/\.[^.]+$/, ''))

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), UPLOAD_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body,
      signal: ac.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    const msg = (e as Error).name === 'AbortError'
      ? `imgbb upload timed out after ${UPLOAD_TIMEOUT_MS / 1000}s`
      : `imgbb unreachable: ${(e as Error).message}`
    return NextResponse.json({ error: msg }, { status: 502 })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    let text: string
    try { text = await res.text() } catch { text = '' }
    let brief = 'Upload failed'
    try {
      const parsed = JSON.parse(text)
      if (parsed?.error?.message) brief = parsed.error.message
      else if (parsed?.status_txt) brief = parsed.status_txt
    } catch {
      if (text.length > 0 && text.length < 200) brief = text
    }
    return NextResponse.json(
      { error: brief, detail: text },
      { status: res.status },
    )
  }

  const data = await res.json()
  const rawUrl = data.data?.image?.url || data.data?.url || data.data?.display_url

  if (!rawUrl) {
    return NextResponse.json({ error: 'No URL returned from upload' }, { status: 500 })
  }

  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  let url = rawUrl
  if (appBase) {
    try {
      const parsed = new URL(rawUrl)
      if (parsed.hostname === 'i.ibb.co') {
        url = `${appBase}/api/img${parsed.pathname}`
      }
    } catch { /* keep raw URL */ }
  }

  return NextResponse.json({ url })
})
