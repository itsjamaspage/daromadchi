import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import { searchByKeyword, searchByBarcode } from '@/lib/ikpu/client'

export const runtime = 'nodejs'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim()
  const barcode = url.searchParams.get('barcode')?.trim()
  const lang = url.searchParams.get('lang') || 'ru'

  if (!q && !barcode) {
    return NextResponse.json({ error: 'q or barcode required' }, { status: 400 })
  }

  const result = barcode
    ? await searchByBarcode(barcode, { lang })
    : await searchByKeyword(q!, { lang })

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  })
})
