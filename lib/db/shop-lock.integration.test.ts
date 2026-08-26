/**
 * The sync lock, against real Postgres.
 *
 * This has to be an integration test: the whole mechanism IS Postgres. A mocked
 * pg_try_advisory_lock would assert that the mock works. What matters is that
 * two runners against the same database genuinely cannot overlap, that the lock
 * is released on every exit path, and that a pooled client does not carry one
 * back into the pool.
 *
 * Run: DATABASE_URL=postgres://… node --import tsx --test lib/db/shop-lock.integration.test.ts
 */
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { pool } from './drizzle'
import { withShopLock, withStockSyncLock, shopSyncLockHeld, lockHeld } from './shop-lock'

after(async () => { await pool.end() })

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>(r => { resolve = r })
  return { promise, resolve }
}

describe('one sync per shop', () => {
  it('refuses a second runner while the first is still going', async () => {
    const shop = randomUUID()
    const firstIsInside = deferred()
    const letFirstFinish = deferred()

    const first = withShopLock(shop, async () => {
      firstIsInside.resolve()
      await letFirstFinish.promise
      return 'first'
    })

    await firstIsInside.promise            // the first is provably mid-flight
    const second = await withShopLock(shop, async () => 'second')
    assert.deepEqual(second, { ran: false }, 'the second runner must not enter')

    letFirstFinish.resolve()
    assert.deepEqual(await first, { ran: true, value: 'first' })
  })

  it('locks per shop, so one seller never blocks another', async () => {
    const a = randomUUID(), b = randomUUID()
    const aInside = deferred(), releaseA = deferred()
    const running = withShopLock(a, async () => { aInside.resolve(); await releaseA.promise; return 'a' })
    await aInside.promise

    const other = await withShopLock(b, async () => 'b')
    assert.deepEqual(other, { ran: true, value: 'b' }, 'a different shop is unaffected')

    releaseA.resolve()
    await running
  })

  it('releases the lock after the work returns', async () => {
    const shop = randomUUID()
    await withShopLock(shop, async () => 'done')
    assert.equal(await shopSyncLockHeld(shop), false)
    const again = await withShopLock(shop, async () => 'again')
    assert.deepEqual(again, { ran: true, value: 'again' }, 'the next tick can run')
  })

  it('releases the lock when the work THROWS, and lets the error through', async () => {
    // The failure mode that would be worst: a sync that dies leaves the shop
    // locked forever and never syncs again.
    const shop = randomUUID()
    await assert.rejects(
      () => withShopLock(shop, async () => { throw new Error('sync blew up') }),
      /sync blew up/,
      'the error must not be swallowed by the lock wrapper',
    )
    assert.equal(await shopSyncLockHeld(shop), false, 'and the lock is gone')
    assert.deepEqual(await withShopLock(shop, async () => 'recovered'), { ran: true, value: 'recovered' })
  })

  it('does not return a lock-carrying connection to the pool', async () => {
    // pg_advisory_lock is session-scoped. Releasing a client that still holds
    // one hands the next borrower a poisoned connection — and because the pool
    // reuses clients, the symptom would appear on an unrelated shop later.
    const shop = randomUUID()
    for (let i = 0; i < 12; i++) {          // more iterations than pool.max (10)
      const r = await withShopLock(shop, async () => i)
      assert.deepEqual(r, { ran: true, value: i }, `iteration ${i} should acquire cleanly`)
    }
    assert.equal(await shopSyncLockHeld(shop), false)
  })

  it('reports nothing held for a shop nobody is syncing', async () => {
    assert.equal(await shopSyncLockHeld(randomUUID()), false)
  })
})

describe('the two lock scopes are independent', () => {
  it('does not let a shop sync block a stock write-back, or vice versa', async () => {
    // stock-sync is keyed on userId and shop-sync on shopId. If the scopes
    // shared a namespace, an id that happened to appear as both would have one
    // silently blocking the other — and the symptom would be stock write-back
    // quietly not running while a long product sync held the key.
    const id = randomUUID()
    const inside = deferred(), release = deferred()
    const syncing = withShopLock(id, async () => { inside.resolve(); await release.promise; return 'sync' })
    await inside.promise

    const stock = await withStockSyncLock(id, async () => 'stock')
    assert.deepEqual(stock, { ran: true, value: 'stock' }, 'a different scope must not be blocked')
    assert.equal(await lockHeld('shop-sync', id), true, 'while the shop lock is genuinely held')

    release.resolve()
    await syncing
    assert.equal(await lockHeld('shop-sync', id), false)
  })

  it('still serialises within the stock-sync scope', async () => {
    const user = randomUUID()
    const inside = deferred(), release = deferred()
    const first = withStockSyncLock(user, async () => { inside.resolve(); await release.promise; return 1 })
    await inside.promise
    assert.deepEqual(await withStockSyncLock(user, async () => 2), { ran: false })
    release.resolve()
    await first
  })
})
