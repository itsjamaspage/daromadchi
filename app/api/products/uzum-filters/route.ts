import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import { getCategoryFilters } from '@/lib/uzum/public'
import { getUzumTemplateFilters } from '@/lib/uzum/static-categories'

export const runtime = 'nodejs'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const categoryId = Number(req.nextUrl.searchParams.get('categoryId'))
  if (!categoryId) return NextResponse.json({ error: 'categoryId required' }, { status: 400 })

  const apiFilters = await getCategoryFilters(categoryId)
  if (apiFilters.length > 0) {
    return NextResponse.json({
      filters: apiFilters.map(f => ({
        id: f.id,
        name: f.title,
        type: f.type,
        values: f.values.map(v => v.value),
      })),
    })
  }

  const templateFilters = getUzumTemplateFilters(categoryId)
  if (templateFilters.length > 0) {
    return NextResponse.json({
      filters: templateFilters.map(f => ({
        id: f.filterId,
        name: f.name,
        type: f.type,
        values: f.values,
      })),
      fallback: true,
    })
  }

  return NextResponse.json({ filters: [] })
})
