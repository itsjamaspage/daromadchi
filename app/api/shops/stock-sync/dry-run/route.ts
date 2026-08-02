import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import { syncStockSyncGroups } from '@/lib/marketplace/stock-sync'

// Inspection gate: run Step A/B with every write FORCED to dry-run and return the
// log of what WOULD be written. This is what you read before flipping a shop to
// live — the dry-run log is the gate, not a formality. Sends nothing to any store.
export const POST = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const result = await syncStockSyncGroups({ userId: user.id, forceDryRun: true })
  return NextResponse.json({ ok: true, ...result })
})
