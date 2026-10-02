import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import { getList3Enums } from '@/lib/uzum/list3-enums'

export const runtime = 'nodejs'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const field = req.nextUrl.searchParams.get('field')
  const query = req.nextUrl.searchParams.get('q')?.toLowerCase() ?? ''

  const enums = getList3Enums()

  if (field === 'colors') {
    const filtered = query
      ? enums.colors.filter(c => c.toLowerCase().includes(query))
      : enums.colors
    return NextResponse.json({ values: filtered })
  }

  if (field === 'sizes') {
    const filtered = query
      ? enums.sizes.filter(s => s.toLowerCase().includes(query))
      : enums.sizes
    return NextResponse.json({ values: filtered.slice(0, 100) })
  }

  if (field === 'countries') {
    const filtered = query
      ? enums.countries.filter(c => c.toLowerCase().includes(query))
      : enums.countries
    return NextResponse.json({ values: filtered })
  }

  if (field === 'brands') {
    if (!query || query.length < 2) {
      return NextResponse.json({ values: [] })
    }
    const filtered = enums.brands.filter(b => b.toLowerCase().includes(query)).slice(0, 50)
    return NextResponse.json({ values: filtered })
  }

  return NextResponse.json({
    colors: enums.colors.length,
    sizes: enums.sizes.length,
    brands: enums.brands.length,
    countries: enums.countries.length,
  })
})
