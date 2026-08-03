import { NextRequest, NextResponse } from 'next/server'
import { and, eq, desc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { withErrorHandler } from '@/lib/api-handler'
import { getCurrentUserId } from '@/lib/db/shop-context'
import { db, suggestedProductGroups, productGroupMerges, products, shops } from '@/lib/db'
import type { CandidateSignals } from '@/lib/products/group-suggester'

export const runtime = 'nodejs'

// GET /api/product-groups/suggestions?status=pending
// Lists the current user's product-group suggestions with both sides' live
// titles + marketplaces (joined, so a renamed/deleted product shows current
// state), plus the stored colour/score/tier/signals. Read-only.
export const GET = withErrorHandler(async (req: NextRequest) => {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status') ?? 'pending'

  // a_product_id / b_product_id are SET NULL on product delete → leftJoin so a
  // suggestion whose product vanished still lists (with null title/marketplace).
  const pa = alias(products, 'pa')
  const pb = alias(products, 'pb')
  const sa = alias(shops, 'sa')
  const sb = alias(shops, 'sb')

  const rows = await db
    .select({
      id: suggestedProductGroups.id,
      a_match_key: suggestedProductGroups.a_match_key,
      b_match_key: suggestedProductGroups.b_match_key,
      a_product_id: suggestedProductGroups.a_product_id,
      b_product_id: suggestedProductGroups.b_product_id,
      a_title: pa.title,
      b_title: pb.title,
      a_marketplace: sa.marketplace,
      b_marketplace: sb.marketplace,
      score: suggestedProductGroups.score,
      tier: suggestedProductGroups.tier,
      signals: suggestedProductGroups.signals,
      status: suggestedProductGroups.status,
      created_at: suggestedProductGroups.created_at,
    })
    .from(suggestedProductGroups)
    .leftJoin(pa, eq(suggestedProductGroups.a_product_id, pa.id))
    .leftJoin(sa, eq(pa.shop_id, sa.id))
    .leftJoin(pb, eq(suggestedProductGroups.b_product_id, pb.id))
    .leftJoin(sb, eq(pb.shop_id, sb.id))
    .where(and(eq(suggestedProductGroups.user_id, userId), eq(suggestedProductGroups.status, status)))
    .orderBy(desc(suggestedProductGroups.score))

  // Surface a top-level colour for the card (both sides agree when colorMatch).
  const out = rows.map((r) => {
    const sig = (r.signals ?? null) as CandidateSignals | null
    return { ...r, color: sig?.colorA ?? sig?.colorB ?? null }
  })

  return NextResponse.json(out)
})

// POST /api/product-groups/suggestions  { id, action: 'approve' | 'reject' }
// Approve → merge b_match_key INTO a_match_key (source→target, the same
// direction computeStockGroups resolves), so остатки regroups. Reject → if the
// suggestion was previously approved, undo that exact merge. Same-status = no-op.
// Never auto-merges; every write is a deliberate user action on ONE suggestion.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const id = typeof body.id === 'string' ? body.id : ''
  const action = body.action as 'approve' | 'reject'
  if (!id || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Scope the lookup to this user — a user can only act on their own suggestions.
  const [suggestion] = await db
    .select()
    .from(suggestedProductGroups)
    .where(and(eq(suggestedProductGroups.id, id), eq(suggestedProductGroups.user_id, userId)))
    .limit(1)

  if (!suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const targetStatus = action === 'approve' ? 'approved' : 'rejected'
  if (suggestion.status === targetStatus) {
    return NextResponse.json({ ok: true, already: true })
  }

  if (action === 'approve') {
    await db.transaction(async (tx) => {
      await tx
        .insert(productGroupMerges)
        .values({
          user_id: userId,
          source_key: suggestion.b_match_key,
          target_key: suggestion.a_match_key,
        })
        .onConflictDoUpdate({
          target: [productGroupMerges.user_id, productGroupMerges.source_key],
          set: { target_key: suggestion.a_match_key, created_at: new Date() },
        })

      await tx
        .update(suggestedProductGroups)
        .set({ status: 'approved', reviewed_at: new Date() })
        .where(eq(suggestedProductGroups.id, id))
    })
  } else {
    await db.transaction(async (tx) => {
      // Only undo the merge if THIS suggestion had created it (exact source+target).
      if (suggestion.status === 'approved') {
        await tx
          .delete(productGroupMerges)
          .where(
            and(
              eq(productGroupMerges.user_id, userId),
              eq(productGroupMerges.source_key, suggestion.b_match_key),
              eq(productGroupMerges.target_key, suggestion.a_match_key),
            ),
          )
      }

      await tx
        .update(suggestedProductGroups)
        .set({ status: 'rejected', reviewed_at: new Date() })
        .where(eq(suggestedProductGroups.id, id))
    })
  }

  return NextResponse.json({ ok: true })
})
