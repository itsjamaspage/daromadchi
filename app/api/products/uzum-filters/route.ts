import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import { getCategoryFilters } from '@/lib/uzum/public'
import { getUzumTemplateFilters } from '@/lib/uzum/static-categories'
import { getCategoryFiltersFallback } from '@/lib/uzum/category-filters-fallback'

export const runtime = 'nodejs'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const categoryId = Number(req.nextUrl.searchParams.get('categoryId'))
  if (!categoryId) return NextResponse.json({ error: 'categoryId required' }, { status: 400 })

  // 1) Try live GraphQL API
  const apiFilters = await getCategoryFilters(categoryId)
  if (apiFilters.length > 0) {
    // Merge with fallback to get required/type metadata
    const fallback = getCategoryFiltersFallback(categoryId)
    const fallbackMap = new Map(fallback.map(f => [f.name.toLowerCase(), f]))

    return NextResponse.json({
      filters: apiFilters.map(f => {
        const fb = fallbackMap.get(f.title.toLowerCase())
        return {
          id: f.id,
          name: f.title,
          type: fb?.type ?? f.type,
          required: fb?.required ?? false,
          min: fb?.min,
          max: fb?.max,
          values: f.values.map(v => v.value),
        }
      }),
      source: 'api',
    })
  }

  // 2) Try template Лист2 data
  const templateFilters = getUzumTemplateFilters(categoryId)
  if (templateFilters.length > 0) {
    const fallback = getCategoryFiltersFallback(categoryId)
    const fallbackMap = new Map(fallback.map(f => [f.name.toLowerCase(), f]))

    return NextResponse.json({
      filters: templateFilters.map(f => {
        const fb = fallbackMap.get(f.name.toLowerCase())
        return {
          id: f.filterId,
          name: f.name,
          type: fb?.type ?? f.type,
          required: fb?.required ?? false,
          min: fb?.min,
          max: fb?.max,
          values: f.values,
        }
      }),
      source: 'template',
    })
  }

  // 3) Use hardcoded fallback for known categories
  const fallback = getCategoryFiltersFallback(categoryId)
  if (fallback.length > 0) {
    return NextResponse.json({
      filters: fallback.map((f, i) => ({
        id: i + 1,
        name: f.name,
        type: f.type,
        required: f.required,
        min: f.min,
        max: f.max,
        values: f.values ?? [],
      })),
      source: 'fallback',
    })
  }

  return NextResponse.json({ filters: [], source: 'none' })
})
