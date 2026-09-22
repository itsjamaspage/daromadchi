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

  const fallback = getCategoryFiltersFallback(categoryId)

  // For categories with hardcoded definitions (sourced from the seller cabinet),
  // always use those as the authoritative list. The GraphQL API returns search
  // facets which are different from seller product attributes.
  if (fallback.length > 0) {
    // Try to enrich fallback with dropdown values from the API or template
    const apiValues = await getApiValueMap(categoryId)
    const templateValues = getTemplateValueMap(categoryId)

    return NextResponse.json({
      filters: fallback.map((f, i) => {
        const apiMatch = apiValues.get(f.name.toLowerCase())
        const tmplMatch = templateValues.get(f.name.toLowerCase())
        const values = apiMatch ?? tmplMatch ?? f.values ?? []
        return {
          id: apiMatch ? (i + 1) : (i + 1),
          name: f.name,
          type: f.type,
          required: f.required,
          min: f.min,
          max: f.max,
          values,
        }
      }),
      source: 'fallback',
    })
  }

  // No hardcoded fallback — try live API
  const apiFilters = await getCategoryFilters(categoryId)
  if (apiFilters.length > 0) {
    return NextResponse.json({
      filters: apiFilters.map(f => ({
        id: f.id,
        name: f.title,
        type: f.type,
        required: false,
        values: f.values.map(v => v.value),
      })),
      source: 'api',
    })
  }

  // Try template Лист2 data
  const templateFilters = getUzumTemplateFilters(categoryId)
  if (templateFilters.length > 0) {
    return NextResponse.json({
      filters: templateFilters.map(f => ({
        id: f.filterId,
        name: f.name,
        type: f.type,
        required: false,
        values: f.values,
      })),
      source: 'template',
    })
  }

  return NextResponse.json({ filters: [], source: 'none' })
})

async function getApiValueMap(categoryId: number): Promise<Map<string, string[]>> {
  try {
    const apiFilters = await getCategoryFilters(categoryId)
    const map = new Map<string, string[]>()
    for (const f of apiFilters) {
      if (f.values.length > 0) {
        map.set(f.title.toLowerCase(), f.values.map(v => v.value))
      }
    }
    return map
  } catch {
    return new Map()
  }
}

function getTemplateValueMap(categoryId: number): Map<string, string[]> {
  const tmpl = getUzumTemplateFilters(categoryId)
  const map = new Map<string, string[]>()
  for (const f of tmpl) {
    if (f.values.length > 0) {
      map.set(f.name.toLowerCase(), f.values)
    }
  }
  return map
}
