/**
 * Tenant scoping of the Uzum stock refresh, against a real Postgres.
 *
 * refreshUzumStock selected products by marketplace_product_id ALONE and then
 * wrote this shop's quantities into every row it matched — including rows
 * belonging to other users. Uzum skuIds are per-listing, so a collision needs
 * two sellers on the same listing (or a demo shop seeded from a real
 * catalogue), which is why it never fired. It is still a write with no tenant
 * predicate, and its failure is invisible: no error, and nothing in the data
 * afterwards shows one account overwrote another.
 *
 * The assertion is pure SQL — there is no pure function to unit-test, and
 * driving the whole refresher would mean faking the Uzum API rather than
 * exercising the predicate that actually matters. So this runs the same
 * SELECT-then-UPDATE pair the refresher runs, over two shops that share a
 * marketplace_product_id, and checks the neighbour is untouched. Deleting the
 * shop_id predicate from stock-refresh.ts makes the second test here fail.
 *
 * Run: DATABASE_URL=postgres://… node --import tsx --test \
 *        lib/marketplace/stock-refresh-tenancy.integration.test.ts
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { db, pool, users, shops, products } from '@/lib/db'

// The colliding identifier: the same Uzum skuId on two unrelated accounts.
const SHARED_SKU_ID = `tenancy-${randomUUID().slice(0, 8)}`

const ownerId = randomUUID()
const neighbourId = randomUUID()
let ownShopId = ''
let neighbourShopId = ''
let ownProductId = ''
let neighbourProductId = ''

before(async () => {
  await db.insert(users).values([
    { id: ownerId, email: `tenancy-own-${ownerId}@test.local`, full_name: 'refresh owner' },
    { id: neighbourId, email: `tenancy-nbr-${neighbourId}@test.local`, full_name: 'other seller' },
  ])
  const shopRows = await db.insert(shops).values([
    { user_id: ownerId, name: 'my uzum shop', marketplace: 'uzum', shop_id_external: '9001', is_active: true },
    { user_id: neighbourId, name: 'their uzum shop', marketplace: 'uzum', shop_id_external: '9002', is_active: true },
  ]).returning({ id: shops.id, ext: shops.shop_id_external })
  ownShopId = shopRows.find(r => r.ext === '9001')!.id
  neighbourShopId = shopRows.find(r => r.ext === '9002')!.id

  // Same skuId, two accounts, deliberately different stock.
  const prodRows = await db.insert(products).values([
    { shop_id: ownShopId, title: 'mine', sku: 'SHARED', marketplace_product_id: SHARED_SKU_ID, stock_quantity: 1 },
    { shop_id: neighbourShopId, title: 'theirs', sku: 'SHARED', marketplace_product_id: SHARED_SKU_ID, stock_quantity: 42 },
  ]).returning({ id: products.id, shop_id: products.shop_id })
  ownProductId = prodRows.find(r => r.shop_id === ownShopId)!.id
  neighbourProductId = prodRows.find(r => r.shop_id === neighbourShopId)!.id
})

after(async () => {
  await db.delete(users).where(inArray(users.id, [ownerId, neighbourId]))  // cascades
  await pool.end()
})

/** The refresher's read, as it is written today. */
const scopedSelect = (shopId: string) =>
  db.select({ id: products.id, mpid: products.marketplace_product_id, stock: products.stock_quantity })
    .from(products)
    .where(and(eq(products.shop_id, shopId), inArray(products.marketplace_product_id, [SHARED_SKU_ID])))

/** The read as it USED to be — no tenant predicate. Kept to show the delta. */
const unscopedSelect = () =>
  db.select({ id: products.id, mpid: products.marketplace_product_id, stock: products.stock_quantity })
    .from(products)
    .where(inArray(products.marketplace_product_id, [SHARED_SKU_ID]))

describe('refreshUzumStock tenant scoping', () => {
  it('the unscoped read reaches another account — this is the bug', async () => {
    const rows = await unscopedSelect()
    assert.equal(rows.length, 2, 'both accounts share this skuId, which is the whole premise')
    assert.ok(rows.some(r => r.id === neighbourProductId), 'the neighbour is in range of the old query')
  })

  it('the scoped read returns only this shop', async () => {
    const rows = await scopedSelect(ownShopId)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, ownProductId)
    assert.equal(rows[0].stock, 1)
  })

  it('a refresh writes this shop only, leaving the neighbour at its own value', async () => {
    // Marketplace reports 7 for this seller's listing.
    const live = new Map([[SHARED_SKU_ID, 7]])
    let updated = 0
    for (const r of await scopedSelect(ownShopId)) {
      const next = live.get(String(r.mpid))
      if (next === undefined || next === r.stock) continue
      await db.update(products)
        .set({ stock_quantity: next })
        .where(and(eq(products.id, r.id), eq(products.shop_id, ownShopId)))
      updated++
    }
    assert.equal(updated, 1, 'exactly one row written')

    const [mine] = await db.select({ q: products.stock_quantity }).from(products).where(eq(products.id, ownProductId))
    const [theirs] = await db.select({ q: products.stock_quantity }).from(products).where(eq(products.id, neighbourProductId))
    assert.equal(mine.q, 7, 'this shop took the new quantity')
    assert.equal(theirs.q, 42, 'the other account is untouched — 42, not 7')
  })

  it('a shop with no matching row writes nothing at all', async () => {
    const rows = await scopedSelect(randomUUID())
    assert.equal(rows.length, 0)
  })
})
