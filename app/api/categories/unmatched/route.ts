import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { withErrorHandler } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/auth/session'
import { db, products, categoryAliases } from '@/lib/db'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADMIN_EMAIL || user.email !== ADMIN_EMAIL)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rows = await db.execute(sql`
    SELECT p.category, COUNT(*) AS product_count
    FROM ${products} p
    LEFT JOIN ${categoryAliases} ca ON ca.original_name = p.category
    WHERE p.category IS NOT NULL
      AND ca.id IS NULL
    GROUP BY p.category
    ORDER BY COUNT(*) DESC
  `)

  return NextResponse.json(rows.rows)
})
