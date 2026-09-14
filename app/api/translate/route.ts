import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'

interface TranslateBody {
  text: string
  from: 'ru' | 'uz'
  to: 'ru' | 'uz'
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text, from, to } = (await req.json()) as TranslateBody

  if (!text?.trim()) {
    return NextResponse.json({ translated: '' })
  }

  if (from === to) {
    return NextResponse.json({ translated: text })
  }

  if (!['ru', 'uz'].includes(from) || !['ru', 'uz'].includes(to)) {
    return NextResponse.json({ error: 'Unsupported language pair' }, { status: 400 })
  }

  const url = new URL('https://translate.googleapis.com/translate_a/single')
  url.searchParams.set('client', 'gtx')
  url.searchParams.set('sl', from)
  url.searchParams.set('tl', to)
  url.searchParams.set('dt', 't')
  url.searchParams.set('q', text.slice(0, 5000))

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Translation service unavailable' }, { status: 502 })
  }

  const data = await res.json()
  const translated = Array.isArray(data?.[0])
    ? data[0].map((seg: [string]) => seg[0] ?? '').join('')
    : ''

  return NextResponse.json({ translated })
})
