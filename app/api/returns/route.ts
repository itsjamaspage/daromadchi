import { NextResponse } from 'next/server'
import { eq, and, inArray } from 'drizzle-orm'
import { db, returnInvoices, returnInvoiceItems, shops } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const userShops = await db.select({ id: shops.id, name: shops.name })
    .from(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.marketplace, 'uzum')))

  if (userShops.length === 0) {
    return NextResponse.json({ returns: [] })
  }

  const shopIds = userShops.map(s => s.id)
  const shopNameMap = new Map(userShops.map(s => [s.id, s.name]))

  const allInvoices = await db.select()
    .from(returnInvoices)
    .where(inArray(returnInvoices.shop_id, shopIds))

  if (allInvoices.length === 0) {
    return NextResponse.json({ returns: [] })
  }

  const invoiceIds = allInvoices.map(i => i.id)
  const items = await db.select()
    .from(returnInvoiceItems)
    .where(inArray(returnInvoiceItems.return_invoice_id, invoiceIds))

  const itemsByInvoice = new Map<string, (typeof items)[number][]>()
  for (const item of items) {
    const arr = itemsByInvoice.get(item.return_invoice_id) ?? []
    arr.push(item)
    itemsByInvoice.set(item.return_invoice_id, arr)
  }

  const returns = allInvoices.map(inv => ({
    ...inv,
    shop_name: shopNameMap.get(inv.shop_id) ?? null,
    items: itemsByInvoice.get(inv.id) ?? [],
  }))

  return NextResponse.json({ returns })
})
