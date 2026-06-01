import { NextRequest, NextResponse } from 'next/server'
import { resyncDays } from '@/lib/db/sync-state'

// POST /api/sync-days — trigger resync for specified dates
export async function POST(req: NextRequest) {
  try {
    const { dates } = await req.json() as { dates: string[] }
    await resyncDays(dates ?? [])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatosi' }, { status: 500 })
  }
}
