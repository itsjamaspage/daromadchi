import { NextRequest, NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { withErrorHandler } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/auth/session'
import { db, suggestedAliases, categoriesCanonical, categoryAliases } from '@/lib/db'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', status: 401 } as const
  if (!ADMIN_EMAIL || user.email !== ADMIN_EMAIL)
    return { error: 'Forbidden', status: 403 } as const
  return null
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const denied = await requireAdmin()
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const status = req.nextUrl.searchParams.get('status') ?? 'pending'

  const rows = await db
    .select({
      id: suggestedAliases.id,
      canonical_slug: categoriesCanonical.slug,
      canonical_name_ru: categoriesCanonical.name_ru,
      canonical_name_en: categoriesCanonical.name_en,
      marketplace: suggestedAliases.marketplace,
      original_name: suggestedAliases.original_name,
      score: suggestedAliases.score,
      tier: suggestedAliases.tier,
      status: suggestedAliases.status,
      created_at: suggestedAliases.created_at,
    })
    .from(suggestedAliases)
    .innerJoin(categoriesCanonical, eq(suggestedAliases.canonical_id, categoriesCanonical.id))
    .where(eq(suggestedAliases.status, status))
    .orderBy(sql`${suggestedAliases.score} DESC`)

  return NextResponse.json(rows)
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const denied = await requireAdmin()
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const body = await req.json()
  const { id, action } = body as { id: number; action: 'approve' | 'reject' }

  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const [suggestion] = await db
    .select()
    .from(suggestedAliases)
    .where(eq(suggestedAliases.id, id))
    .limit(1)

  if (!suggestion) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (action === 'approve') {
    await db.transaction(async (tx) => {
      await tx
        .insert(categoryAliases)
        .values({
          canonical_id: suggestion.canonical_id,
          marketplace: suggestion.marketplace,
          original_name: suggestion.original_name,
        })
        .onConflictDoNothing()

      await tx
        .update(suggestedAliases)
        .set({ status: 'approved', reviewed_at: new Date() })
        .where(eq(suggestedAliases.id, id))
    })
  } else {
    await db
      .update(suggestedAliases)
      .set({ status: 'rejected', reviewed_at: new Date() })
      .where(eq(suggestedAliases.id, id))
  }

  return NextResponse.json({ ok: true })
})
