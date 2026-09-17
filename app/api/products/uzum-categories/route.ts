import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import { getRootCategories } from '@/lib/uzum/public'

export const runtime = 'nodejs'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tree = await getRootCategories()
  if (tree.length === 0) {
    return NextResponse.json(
      { error: 'Не удалось загрузить категории Uzum — попробуйте позже' },
      { status: 502 },
    )
  }
  return NextResponse.json({ categories: tree })
})
