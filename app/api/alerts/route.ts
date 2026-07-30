import { NextResponse } from 'next/server'
import { getStockAlerts } from '@/lib/db/alerts'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'

// Explicit 401 at the top so a future refactor of getStockAlerts that
// drops its internal user-scoping still can't leak data to anonymous
// callers — the API surface stops before touching the DB helper.
export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const alerts = await getStockAlerts()
  return NextResponse.json({ alerts })
})
