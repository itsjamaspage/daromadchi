import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq, sql } from 'drizzle-orm'
import { db, shops, products, users, stockWriteLog } from '@/lib/db'
import { reconcilePhysicalStock } from './physical-stock'

/**
 * The JMBLK freeze.
 *
 * Both marketplaces reported 0 and Daromadchi kept showing 1 on hand, on a SKU
 * with no open orders at all — so the order-decrement band was not involved.
 * The cause was the value-match guard taking the most recent 'sent' write with
 * NO TIME BOUND: the seller zeroed Uzum, we mirrored 0 to Yandex, and from then
 * on a genuine listing of 0 matched our own write of 0 and was refused forever.
 *
 * Run: DATABASE_URL=… node --import tsx --test lib/marketplace/physical-stock.integration.test.ts
 */

let userId: string, shopId: string

async function makeProduct(sku: string, listed: number, physical: number): Promise<string> {
  const id = crypto.randomUUID()
  await db.insert(products).values({
    id, shop_id: shopId, sku, marketplace_product_id: sku,
    title: sku, stock_quantity: listed, physical_stock: physical,
  } as never)
  return id
}

async function logWrite(productId: string, quantity: number, ageHours: number) {
  await db.insert(stockWriteLog).values({
    shop_id: shopId, product_id: productId, marketplace: 'yandex_market',
    requested_quantity: quantity, quantity, status: 'sent', dry_run: false,
    endpoint: '/test', method: 'PUT',
    created_at: sql`now() - interval '${sql.raw(String(ageHours))} hours'`,
  } as never)
}

const physicalOf = async (id: string) =>
  Number((await db.select({ p: products.physical_stock }).from(products).where(eq(products.id, id)))[0]?.p ?? -1)

before(async () => {
  userId = crypto.randomUUID(); shopId = crypto.randomUUID()
  await db.insert(users).values({ id: userId, email: `pst+${Date.now()}@t.local`, name: 'pst' } as never)
  await db.insert(shops).values({
    id: shopId, user_id: userId, name: 'pst', marketplace: 'yandex_market', is_active: true,
  } as never)
})
after(async () => { await db.delete(users).where(eq(users.id, userId)) })

describe('reconcilePhysicalStock', () => {
  test('THE BUG: a stale write of 0 no longer freezes the pool forever', async () => {
    // We mirrored 0 days ago. The listing is genuinely 0 now. Nothing is on order.
    const id = await makeProduct(`JMBLK-${Date.now()}`, 0, 1)
    await logWrite(id, 0, 48)

    await reconcilePhysicalStock(shopId)

    assert.equal(await physicalOf(id), 0,
      'a listing that has read 0 for two days is the truth, not our old write echoing back')
  })

  test('a RECENT write of ours is still not adopted — the guard it exists for', async () => {
    // We throttled this listing down to 1 minutes ago; the pool is really 2.
    const id = await makeProduct(`THROTTLE-${Date.now()}`, 1, 2)
    await logWrite(id, 1, 0)

    await reconcilePhysicalStock(shopId)

    assert.equal(await physicalOf(id), 2, 'our own mirror write must never feed the pool')
  })

  test('a seller restock is adopted whatever we wrote before', async () => {
    const id = await makeProduct(`RESTOCK-${Date.now()}`, 7, 1)
    await logWrite(id, 1, 0)

    await reconcilePhysicalStock(shopId)

    assert.equal(await physicalOf(id), 7)
  })

  test('a product we have never written to is adopted', async () => {
    const id = await makeProduct(`NEVER-${Date.now()}`, 0, 3)

    await reconcilePhysicalStock(shopId)

    assert.equal(await physicalOf(id), 0)
  })
})
