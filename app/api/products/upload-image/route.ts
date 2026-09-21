import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'

const IMGBB_API_KEY = process.env.IMGBB_API_KEY

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!IMGBB_API_KEY) {
    return NextResponse.json({ error: 'Image upload not configured' }, { status: 500 })
  }

  const formData = await req.formData()
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

  const res = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    let brief = 'Upload failed'
    try {
      const parsed = JSON.parse(text)
      if (parsed?.error?.message) brief = parsed.error.message
      else if (parsed?.status_txt) brief = parsed.status_txt
    } catch {
      if (text.length < 200) brief = text
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
