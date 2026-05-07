import { NextRequest, NextResponse } from 'next/server'
import { addUnitEconomicsItem, deleteUnitEconomicsItems, updateUnitEconomicsSupplier } from '@/lib/db/unit-economics'
import type { UnitEconomicsItem } from '@/lib/types'

// POST /api/unit-economics — add item (called from extension or UI)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Omit<UnitEconomicsItem, 'id' | 'addedAt'>
    const result = await addUnitEconomicsItem(body)
    if (!result) return NextResponse.json({ ok: false, error: 'Saqlab bo\'lmadi' }, { status: 400 })
    return NextResponse.json({ ok: true, id: result.id })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatosi' }, { status: 500 })
  }
}

// DELETE /api/unit-economics — bulk delete by ids[]
export async function DELETE(req: NextRequest) {
  try {
    const { ids } = await req.json() as { ids: string[] }
    await deleteUnitEconomicsItems(ids ?? [])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatosi' }, { status: 500 })
  }
}

// PATCH /api/unit-economics — update supplier URL for one item
export async function PATCH(req: NextRequest) {
  try {
    const { id, supplierUrl } = await req.json() as { id: string; supplierUrl: string }
    await updateUnitEconomicsSupplier(id, supplierUrl)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatosi' }, { status: 500 })
  }
}
