import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import { getRootCategories } from '@/lib/uzum/public'
import { UZUM_STATIC_CATEGORIES } from '@/lib/uzum/static-categories'

export const runtime = 'nodejs'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tree = await getRootCategories()
  if (tree.length > 0) {
    return NextResponse.json({ categories: tree })
  }

  return NextResponse.json({ categories: UZUM_STATIC_CATEGORIES, fallback: true })
})
