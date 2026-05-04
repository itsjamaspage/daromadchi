import { NextRequest, NextResponse } from 'next/server'
import { getCategoryProducts, searchMarketProducts } from '@/lib/uzum/public'

type SortOption = 'ORDER_COUNT_DESC' | 'PRICE_ASC' | 'PRICE_DESC' | 'RATING_DESC'
const VALID_SORTS: SortOption[] = ['ORDER_COUNT_DESC', 'PRICE_ASC', 'PRICE_DESC', 'RATING_DESC']

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const categoryId = searchParams.get('categoryId')
  const query      = searchParams.get('q')
  const rawSort    = searchParams.get('sort') ?? 'ORDER_COUNT_DESC'
  const sort       = (VALID_SORTS.includes(rawSort as SortOption) ? rawSort : 'ORDER_COUNT_DESC') as SortOption

  try {
    if (categoryId) {
      const id = parseInt(categoryId, 10)
      if (isNaN(id)) return NextResponse.json({ error: 'Invalid categoryId' }, { status: 400 })
      const result = await getCategoryProducts(id, 0, 40, sort)
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      })
    }

    if (query) {
      const result = await searchMarketProducts(query, 40, sort)
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      })
    }

    return NextResponse.json({ error: 'categoryId or q required' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
