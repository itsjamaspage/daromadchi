import { NextRequest, NextResponse } from 'next/server'
import { searchWbProducts } from '@/lib/wildberries/public'
import { withErrorHandler } from '@/lib/api-handler'

type SortOption = 'popular' | 'priceup' | 'pricedown' | 'rate'
const VALID_SORTS: SortOption[] = ['popular', 'priceup', 'pricedown', 'rate']

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl
  const query   = searchParams.get('q')
  const rawSort = searchParams.get('sort') ?? 'popular'
  const sort    = (VALID_SORTS.includes(rawSort as SortOption) ? rawSort : 'popular') as SortOption

  if (!query) {
    return NextResponse.json({ error: 'q required' }, { status: 400 })
  }

  try {
    const result = await searchWbProducts(query, sort, 40)
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
