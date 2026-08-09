import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { syncFromUzum } from '@/lib/uzum/sync'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, orders } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { withErrorHandler } from '@/lib/api-handler'

export const runtime = 'nodejs'
export const maxDuration = 120

// ── ONE-TIME force re-sync of Uzum order statuses ──────────────────────────────
// After a STATUS_MAP correction, already-stored orders keep their OLD mapped
// status until the order is re-fetched (the DB stores the mapped status, not the
// raw Uzum status, so it can't be re-mapped from the DB alone). This endpoint
// re-runs the full Uzum sync — which re-fetches every order and re-writes its
// status through the CURRENT STATUS_MAP with no change-detection — then reports
// exactly which orders' statuses changed, so you can confirm the re-map.
//
// Same underlying sync the 15-min cron runs, so no extra side effects. Guarded
// behind ?run=1 so a stray GET can't trigger a sync. Read-only report otherwise.
export const GET = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Avtorizatsiya talab etiladi' }, { status: 401 })

  const run = new URL(req.url).searchParams.get('run') === '1'
  if (!run) {
    return NextResponse.json({
      ok: true,
      ready: true,
      hint: 'Add ?run=1 to force a full Uzum order re-sync and re-map every order through the corrected STATUS_MAP. Returns a before/after status diff.',
    })
  }

  const [shop] = await db.select({ id: shops.id, api_key_encrypted: shops.api_key_encrypted })
    .from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'uzum'), eq(shops.is_active, true)))
  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'Uzum shop/token topilmadi' }, { status: 400 })
  }

  // Snapshot every order's status BEFORE the re-sync.
  const readAll = () => db.select({ ext: orders.order_id_external, status: orders.status })
    .from(orders).where(eq(orders.shop_id, shop.id))
  const beforeRows = await readAll()
  const beforeMap = new Map(beforeRows.map(o => [o.ext ?? '', o.status as string]))

  // Full sync: re-fetches every order and re-writes status via the current
  // STATUS_MAP (toUpdOrd writes status unconditionally — no change-detection).
  const token = decrypt(shop.api_key_encrypted)
  const result = await syncFromUzum(shop.id, token)

  const afterRows = await readAll()
  const afterMap = new Map(afterRows.map(o => [o.ext ?? '', o.status as string]))

  // Diff: orders whose stored status changed across the re-sync.
  const changes: { orderId: string; from: string | null; to: string }[] = []
  for (const [ext, to] of afterMap) {
    const from = beforeMap.get(ext)
    if (from !== undefined && from !== to) changes.push({ orderId: ext, from, to })
  }

  const countBy = (m: Map<string, string>) => {
    const c: Record<string, number> = {}
    for (const s of m.values()) c[s] = (c[s] ?? 0) + 1
    return c
  }

  const TARGET = '121172241'
  revalidateTag('order-data', { expire: 0 })

  return NextResponse.json({
    ok: result.ok,
    syncError: result.ok ? undefined : result.error,
    totalOrders: afterMap.size,
    statusChangedCount: changes.length,
    // Orders that re-mapped (e.g. confirmed -> delivered after the fix).
    changes,
    order121172241: {
      before: beforeMap.get(TARGET) ?? '(not found)',
      after: afterMap.get(TARGET) ?? '(not found)',
      flippedToDelivered: afterMap.get(TARGET) === 'delivered',
    },
    statusCountsBefore: countBy(beforeMap),
    statusCountsAfter: countBy(afterMap),
    hint: 'statusChangedCount = how many orders re-mapped. order121172241.after should be "delivered". If it stayed the same, Uzum did not return that order in the fetch — tell support.',
  })
})
