import { NextRequest, NextResponse } from 'next/server'
import { saveUnitEcoSettings } from '@/lib/db/unit-economics'
import type { UnitEcoSettings } from '@/lib/types'

// POST /api/unit-economics/settings — persist unit economics defaults
export async function POST(req: NextRequest) {
  try {
    const settings = await req.json() as UnitEcoSettings
    await saveUnitEcoSettings(settings)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatosi' }, { status: 500 })
  }
}
