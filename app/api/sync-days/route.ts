import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/session'
import { resyncDays } from '@/lib/db/sync-state'
import { withErrorHandler } from '@/lib/api-handler'
import type { MarketplaceType } from '@/lib/types'

const SyncDaysSchema = z.object({
  dates:       z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD formatda bo\'lishi kerak')).max(31),
  marketplace: z.enum(['wildberries', 'uzum', 'yandex_market']).optional(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const raw = await req.json().catch(() => null)
  const parsed = SyncDaysSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Noto\'g\'ri ma\'lumot' }, { status: 400 })
  }

  const { dates, marketplace } = parsed.data
  await resyncDays((marketplace ?? 'wildberries') as MarketplaceType, dates ?? [])
  return NextResponse.json({ ok: true })
})
