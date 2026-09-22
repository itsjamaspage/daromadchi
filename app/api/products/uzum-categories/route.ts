import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import { getRootCategories } from '@/lib/uzum/public'
import { getUzumTemplateCategories } from '@/lib/uzum/static-categories'

export const runtime = 'nodejs'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tree = await getRootCategories()
  if (tree.length > 0) {
    return NextResponse.json({ categories: tree })
  }

  const templateTree = getUzumTemplateCategories()
  if (templateTree.length > 0) {
    return NextResponse.json({ categories: templateTree, fallback: true })
  }

  return NextResponse.json({ categories: [], fallback: true })
})
