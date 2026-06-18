import { NextRequest, NextResponse } from 'next/server'
import { addUnitEconomicsItem, deleteUnitEconomicsItems, updateUnitEconomicsSupplier, updateUnitEconomicsItem } from '@/lib/db/unit-economics'

const MARKETPLACES = ['uzum', 'yandex_market', 'wildberries'] as const

// Fields that may be updated via PATCH
const ALLOWED_UPDATE_FIELDS = new Set([
  'title', 'image', 'sku', 'category', 'marketplace',
  'sellingPrice', 'costPrice', 'commissionPct', 'commission',
  'delivery', 'lastMile', 'acquiring', 'adSpend', 'tax',
  'netProfit', 'roi', 'margin', 'stock', 'weight',
  'supplierUrl', 'productUrl',
])

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })

    if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 500) {
      return NextResponse.json({ ok: false, error: 'title majburiy (max 500 belgi)' }, { status: 400 })
    }
    if (!MARKETPLACES.includes(body.marketplace)) {
      return NextResponse.json({ ok: false, error: 'marketplace noto\'g\'ri' }, { status: 400 })
    }
    if (!isFiniteNum(body.sellingPrice) || body.sellingPrice < 0) {
      return NextResponse.json({ ok: false, error: 'sellingPrice manfiy bo\'lmasligi kerak' }, { status: 400 })
    }
    if (!isFiniteNum(body.costPrice) || body.costPrice < 0) {
      return NextResponse.json({ ok: false, error: 'costPrice manfiy bo\'lmasligi kerak' }, { status: 400 })
    }

    const result = await addUnitEconomicsItem(body)
    if (result === null)  return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 })
    if (result === false) return NextResponse.json({ ok: false, error: 'Saqlashda xato yuz berdi' }, { status: 500 })
    return NextResponse.json({ ok: true, id: result.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const ids = body?.ids
    if (!Array.isArray(ids) || ids.length > 200) {
      return NextResponse.json({ ok: false, error: 'ids array talab etiladi (max 200)' }, { status: 400 })
    }
    if (!ids.every((id: unknown) => typeof id === 'string' && id.length <= 100)) {
      return NextResponse.json({ ok: false, error: 'ids noto\'g\'ri format' }, { status: 400 })
    }
    await deleteUnitEconomicsItems(ids)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatosi' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })

    const { id, ...rawFields } = body
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ ok: false, error: 'id talab etiladi' }, { status: 400 })
    }

    // Strip any fields not in the allowlist
    const fields: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(rawFields)) {
      if (ALLOWED_UPDATE_FIELDS.has(k)) fields[k] = v
    }
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: false, error: 'O\'zgartirish yo\'q' }, { status: 400 })
    }

    // Legacy path: only supplierUrl
    if (Object.keys(fields).length === 1 && 'supplierUrl' in fields) {
      await updateUnitEconomicsSupplier(id, fields.supplierUrl as string)
      return NextResponse.json({ ok: true })
    }
    const ok = await updateUnitEconomicsItem(id, fields as Parameters<typeof updateUnitEconomicsItem>[1])
    return NextResponse.json({ ok })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatosi' }, { status: 500 })
  }
}
