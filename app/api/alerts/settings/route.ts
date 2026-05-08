import { NextRequest, NextResponse } from 'next/server'
import { saveAlertSettings } from '@/lib/db/alerts'
import type { AlertSettings } from '@/lib/db/alerts'

// POST /api/alerts/settings — persist alert settings
export async function POST(req: NextRequest) {
  try {
    const settings = await req.json() as AlertSettings
    await saveAlertSettings(settings)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatosi' }, { status: 500 })
  }
}
