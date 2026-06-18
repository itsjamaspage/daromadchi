import { NextRequest, NextResponse } from 'next/server'
import { saveUnitEcoSettings } from '@/lib/db/unit-economics'

const PCT_FIELDS = ['acquiringPct', 'lastMilePct', 'adPct', 'taxPct', 'defaultCommissionPct'] as const
const TAX_TYPES  = ['income', 'income_minus_expense'] as const

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })

    for (const field of PCT_FIELDS) {
      const v = body[field]
      if (typeof v !== 'number' || !isFinite(v) || v < 0 || v > 100) {
        return NextResponse.json({ ok: false, error: `${field}: 0–100 orasida bo'lishi kerak` }, { status: 400 })
      }
    }
    if (!TAX_TYPES.includes(body.taxType)) {
      return NextResponse.json({ ok: false, error: 'taxType noto\'g\'ri' }, { status: 400 })
    }

    await saveUnitEcoSettings({
      acquiringPct:          body.acquiringPct,
      lastMilePct:           body.lastMilePct,
      adPct:                 body.adPct,
      taxPct:                body.taxPct,
      taxType:               body.taxType,
      defaultCommissionPct:  body.defaultCommissionPct,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatosi' }, { status: 500 })
  }
}
