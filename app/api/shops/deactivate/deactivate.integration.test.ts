/**
 * Shop deactivation, against a real Postgres.
 *
 * The flag itself is trivial; what needs proving is the half that makes it mean
 * anything — that a deactivated shop actually DROPS OUT of the user-scoping
 * reads. That is all SQL, so there is no pure function to unit-test: the only
 * check worth having runs the real queries against real rows.
 *
 * Run: DATABASE_URL=postgres://… node --import tsx --test \
 *        app/api/shops/deactivate/deactivate.integration.test.ts
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { db, pool, users, shops, orders } from '@/lib/db'
import { getShopIds } from '@/lib/api/auth'
import { computeTurnover30d } from '@/lib/db/turnover'

const userId = randomUUID()
let activeShopId = ''
let staleShopId = ''

before(async () => {
  await db.insert(users).values({
    id: userId, email: `deactivate-${userId}@test.local`, full_name: 'deactivate test',
  })
  const rows = await db.insert(shops).values([
    { user_id: userId, name: 'campaign A', marketplace: 'yandex_market', shop_id_external: '111', is_active: true },
    { user_id: userId, name: 'campaign B', marketplace: 'yandex_market', shop_id_external: '222', is_active: true },
  ]).returning({ id: shops.id, ext: shops.shop_id_external })
  activeShopId = rows.find(r => r.ext === '111')!.id
  staleShopId  = rows.find(r => r.ext === '222')!.id

  // One order on each, inside the 30-day turnover window.
  await db.insert(orders).values([
    { shop_id: activeShopId, order_id_external: 'A-1', marketplace: 'yandex_market',
      status: 'delivered', revenue: '100000', items_count: 1, ordered_at: new Date() },
    { shop_id: staleShopId, order_id_external: 'B-1', marketplace: 'yandex_market',
      status: 'delivered', revenue: '900000', items_count: 1, ordered_at: new Date() },
  ])
})

after(async () => {
  await db.delete(orders).where(inArray(orders.shop_id, [activeShopId, staleShopId]))
  await db.delete(shops).where(eq(shops.user_id, userId))
  await db.delete(users).where(eq(users.id, userId))
  await pool.end()
})

describe('deactivating a shop', () => {
  it('starts with both shops visible and both counted in turnover', async () => {
    const ids = await getShopIds(userId)
    assert.equal(ids.length, 2, 'both shops should be visible before deactivation')

    const turnover = await computeTurnover30d(userId)
    assert.equal(turnover, 1_000_000, 'both shops contribute before deactivation')
  })

  it('drops the deactivated shop out of the user-scoping read', async () => {
    await db.update(shops).set({ is_active: false }).where(eq(shops.id, staleShopId))

    const ids = await getShopIds(userId)
    assert.deepEqual(ids, [activeShopId], 'only the active shop should remain visible')
  })

  it('drops the deactivated shop out of turnover — the billing half', async () => {
    // This is the criterion that matters: the flag flipping is not enough, the
    // stale shop must stop inflating the tier.
    const turnover = await computeTurnover30d(userId)
    assert.equal(turnover, 100_000, 'the deactivated shop must not count toward turnover')
  })

  it('leaves the other shop and ALL data untouched — soft, never destructive', async () => {
    const remaining = await db.select({ id: orders.id, shop_id: orders.shop_id })
      .from(orders).where(inArray(orders.shop_id, [activeShopId, staleShopId]))
    assert.equal(remaining.length, 2, 'deactivation must never delete order rows')

    const [stale] = await db.select({ id: shops.id, is_active: shops.is_active })
      .from(shops).where(eq(shops.id, staleShopId))
    assert.ok(stale, 'the shop row itself must survive — this is a soft delete')
    assert.equal(stale.is_active, false)
  })

  it('is reversible', async () => {
    await db.update(shops).set({ is_active: true }).where(eq(shops.id, staleShopId))
    const ids = await getShopIds(userId)
    assert.equal(ids.length, 2, 'reactivating restores visibility')
    assert.equal(await computeTurnover30d(userId), 1_000_000)
  })
})
