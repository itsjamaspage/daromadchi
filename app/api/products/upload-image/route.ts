import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

const IMGBB_API_KEY = process.env.IMGBB_API_KEY
const UPLOAD_TIMEOUT_MS = 30_000
const UPLOADS_DIR = path.join(process.cwd(), '.uploads')

function getAppBase() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
}

async function saveLocally(buffer: Buffer, originalName: string): Promise<string> {
  await mkdir(UPLOADS_DIR, { recursive: true })
  const ext = path.extname(originalName).toLowerCase() || '.jpg'
  const filename = `${randomUUID()}${ext}`
  await writeFile(path.join(UPLOADS_DIR, filename), buffer)
  const appBase = getAppBase()
  return appBase ? `${appBase}/api/uploads/${filename}` : `/api/uploads/${filename}`
}

async function uploadToImgbb(base64: string, name: string): Promise<{ url: string } | { error: string }> {
  if (!IMGBB_API_KEY) return { error: 'IMGBB_API_KEY missing' }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), UPLOAD_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ key: IMGBB_API_KEY, image: base64, name }),
      signal: ac.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    return { error: (e as Error).name === 'AbortError' ? 'imgbb timed out' : (e as Error).message }
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    let text: string
    try { text = await res.text() } catch { text = '' }
    let brief = `imgbb ${res.status}`
    try {
      const parsed = JSON.parse(text)
      if (parsed?.error?.message) brief = parsed.error.message
      else if (parsed?.status_txt) brief = parsed.status_txt
    } catch {
      if (text.length > 0 && text.length < 200) brief = text
    }
    return { error: brief }
  }

  const data = await res.json()
  const rawUrl = data.data?.image?.url || data.data?.url || data.data?.display_url
  if (!rawUrl) return { error: 'No URL in imgbb response' }

  const appBase = getAppBase()
  let url = rawUrl
  if (appBase) {
    try {
      const parsed = new URL(rawUrl)
      if (parsed.hostname === 'i.ibb.co') {
        url = `${appBase}/api/img${parsed.pathname}`
      }
    } catch { /* keep raw URL */ }
  }

  return { url }
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const name = file.name.replace(/\.[^.]+$/, '')

  const imgbbResult = await uploadToImgbb(buffer.toString('base64'), name)

  if ('url' in imgbbResult) {
    return NextResponse.json({ url: imgbbResult.url })
  }

  console.warn('[upload-image] imgbb failed, using local storage:', imgbbResult.error)
  const localUrl = await saveLocally(buffer, file.name)
  return NextResponse.json({ url: localUrl, fallback: 'local' })
})
