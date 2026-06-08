import { NextRequest, NextResponse } from 'next/server'
import { addUnitEconomicsItem, deleteUnitEconomicsItems, updateUnitEconomicsSupplier, updateUnitEconomicsItem } from '@/lib/db/unit-economics'
import type { UnitEconomicsItem } from '@/lib/types'

// POST /api/unit-economics — add item (called from extension or UI)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Omit<UnitEconomicsItem, 'id' | 'addedAt'>
    const result = await addUnitEconomicsItem(body)
    if (result === null) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 })
    if (result === false) return NextResponse.json({ ok: false, error: 'Saqlashda xato yuz berdi' }, { status: 500 })
    return NextResponse.json({ ok: true, id: result.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
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

// PATCH /api/unit-economics — update item fields (supplierUrl only, or full edit)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id: string } & Record<string, unknown>
    const { id, ...fields } = body
    if (!id) return NextResponse.json({ ok: false, error: 'id talab etiladi' }, { status: 400 })
    // Legacy path: only supplierUrl passed
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
