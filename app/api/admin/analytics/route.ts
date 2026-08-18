/**
 * Admin-only analytics feed. Read-only: GET is the only method.
 *
 * The gate here is independent of the page's gate — a non-admin hitting this
 * URL directly gets 403 and no row of anyone else's data.
 */
import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { requireAdminApi } from '@/lib/auth/admin'
import { getAdminAnalytics } from '@/lib/db/admin-analytics'

export const GET = withErrorHandler(async () => {
  const denied = await requireAdminApi()
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const data = await getAdminAnalytics()
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store, private' },
  })
})
