/**
 * Plan gating, against a real Postgres.
 *
 * The rules in features.ts already have unit tests; what those cannot prove is
 * that the DATABASE-facing half agrees with them — that the right columns are
 * read, that a shop's api_mode decides the Stocks page the way the spec says,
 * and that a gated account cannot start a marketplace write-back run. Every
 * assertion below runs the real code against real rows.
 *
 * Run: DATABASE_URL=postgres://… node --import tsx --test lib/billing/entitlement.integration.test.ts
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, pool, users, shops } from '@/lib/db'
import { loadEntitlement, userHasFeature, everyActiveShopIsReadOnly } from './entitlement'
import { lockedNavKeys } from './nav-gating'
import { syncStockSyncGroups } from '@/lib/marketplace/stock-sync'

const DAY = 24 * 60 * 60 * 1000
const ago = (d: number) => new Date(Date.now() - d * DAY)
const ahead = (d: number) => new Date(Date.now() + d * DAY)

const created: string[] = []

async function seedUser(fields: {
  plan?: string
  planExpiresAt?: Date | null
  trialEndsAt?: Date | null
  grandfathered?: boolean
}): Promise<string> {
  const id = randomUUID()
  await db.insert(users).values({
    id,
    email: `${id}@gating.test`,
    plan: (fields.plan ?? 'free') as 'free',
    plan_expires_at: fields.planExpiresAt ?? null,
    trial_ends_at: fields.trialEndsAt ?? null,
    is_grandfathered: fields.grandfathered ?? false,
  })
  created.push(id)
  return id
}

async function seedShop(userId: string, apiMode: 'read_only' | 'stock_sync', active = true) {
  await db.insert(shops).values({
    user_id: userId,
    marketplace: 'uzum',
    name: `shop-${apiMode}`,
    api_mode: apiMode,
    is_active: active,
  })
}

/** The four capabilities a paid plan unlocks, and the four Free keeps forever. */
const GATED = ['analytics', 'stock_sync', 'finances', 'unit_economics'] as const
const FREE_FOREVER = ['dashboard', 'products', 'orders', 'marketplaces'] as const

// Teardown at module level, not per suite: a suite-scoped `after` closes the
// pool while later suites still need it.
after(async () => {
  for (const id of created) await db.delete(users).where(eq(users.id, id))
  await pool.end()
})

describe('entitlement — what the database says a seller may use', () => {
  it('a free account inside its trial has everything', async () => {
    const id = await seedUser({ trialEndsAt: ahead(3) })
    for (const f of [...GATED, ...FREE_FOREVER]) {
      assert.equal(await userHasFeature(id, f), true, `${f} should be open during the trial`)
    }
    assert.deepEqual(await lockedNavKeys(id), [])
  })

  it('a free account past its trial keeps the free-forever set and loses the rest', async () => {
    const id = await seedUser({ trialEndsAt: ago(1) })
    for (const f of FREE_FOREVER) {
      assert.equal(await userHasFeature(id, f), true, `${f} must stay free forever`)
    }
    for (const f of GATED) {
      assert.equal(await userHasFeature(id, f), false, `${f} must be gated after the trial`)
    }
  })

  it('the trial expires at the timestamp, not on the next cron day', async () => {
    const id = await seedUser({ trialEndsAt: new Date(Date.now() + 60_000) })
    const entitlement = await loadEntitlement(id)
    assert.equal(await userHasFeature(id, 'analytics'), true)
    // One second past the recorded end — no job has run in between.
    const justAfter = new Date(Date.now() + 61_000)
    assert.equal(
      (await import('./features')).hasFeature(entitlement, 'analytics', justAfter),
      false,
      'access must end at trial_ends_at, not whenever a job next runs',
    )
  })

  it('a paid plan opens everything, an expired one does not', async () => {
    const live = await seedUser({ plan: 'pro', planExpiresAt: ahead(20), trialEndsAt: ago(30) })
    for (const f of GATED) assert.equal(await userHasFeature(live, f), true, `${f} on live pro`)
    assert.deepEqual(await lockedNavKeys(live), [])

    const lapsed = await seedUser({ plan: 'pro', planExpiresAt: ago(1), trialEndsAt: ago(30) })
    for (const f of GATED) assert.equal(await userHasFeature(lapsed, f), false, `${f} on lapsed pro`)
  })

  it('biznes is a paid plan too', async () => {
    const id = await seedUser({ plan: 'biznes', planExpiresAt: ahead(20), trialEndsAt: ago(30) })
    for (const f of GATED) assert.equal(await userHasFeature(id, f), true, `${f} on biznes`)
  })

  it('enterprise is understood by the rules even though the enum cannot store it', async () => {
    // The plan_type enum stops at biznes, so no row can hold 'enterprise' today
    // — enterprise is invoiced by hand and nothing writes that value. The rules
    // still answer for it, which is what the enterprise branch will need; this
    // pins the behaviour without pretending the column supports it.
    const { hasFeature } = await import('./features')
    for (const f of GATED) {
      assert.equal(
        hasFeature({ plan: 'enterprise', planExpiresAt: ahead(20), trialEndsAt: ago(30) }, f),
        true,
        `${f} on enterprise`,
      )
    }
  })

  it('a grandfathered account is never gated, whatever its plan says', async () => {
    const id = await seedUser({ plan: 'free', trialEndsAt: ago(90), grandfathered: true })
    for (const f of GATED) assert.equal(await userHasFeature(id, f), true, `${f} for a grandfathered account`)
    assert.deepEqual(await lockedNavKeys(id), [])
  })

  it('never reads the derived tier: high turnover does not buy access', async () => {
    const id = await seedUser({ trialEndsAt: ago(1) })
    await db.update(users)
      .set({ derived_tier: 'biznes', derived_turnover_som: '150000000' })
      .where(eq(users.id, id))
    assert.equal(await userHasFeature(id, 'analytics'), false,
      'a recommendation must never grant the paid product without a payment')
  })
})

describe('the Stocks page rule — gated only when nothing is left to show', () => {
  it('one active stock_sync shop keeps the page', async () => {
    const id = await seedUser({ trialEndsAt: ago(1) })
    await seedShop(id, 'read_only')
    await seedShop(id, 'stock_sync')
    assert.equal(await everyActiveShopIsReadOnly(id), false)
    assert.equal((await lockedNavKeys(id)).includes('stocks'), false,
      'a seller with live write-back still has something real to look at')
  })

  it('all read_only shops locks the page', async () => {
    const id = await seedUser({ trialEndsAt: ago(1) })
    await seedShop(id, 'read_only')
    await seedShop(id, 'read_only')
    assert.equal(await everyActiveShopIsReadOnly(id), true)
    assert.equal((await lockedNavKeys(id)).includes('stocks'), true)
  })

  it('an INACTIVE stock_sync shop does not hold the page open', async () => {
    const id = await seedUser({ trialEndsAt: ago(1) })
    await seedShop(id, 'read_only')
    await seedShop(id, 'stock_sync', false)
    assert.equal(await everyActiveShopIsReadOnly(id), true,
      'a disabled shop syncs nothing, so it cannot justify keeping the page')
  })

  it('a paid seller with only read_only shops keeps the page', async () => {
    const id = await seedUser({ plan: 'pro', planExpiresAt: ahead(20), trialEndsAt: ago(30) })
    await seedShop(id, 'read_only')
    assert.equal((await lockedNavKeys(id)).includes('stocks'), false)
  })
})

describe('write-back is refused for a gated account', () => {
  it('syncStockSyncGroups plans zero writes and never reaches a marketplace', async () => {
    const id = await seedUser({ trialEndsAt: ago(1) })
    await seedShop(id, 'stock_sync')

    // Any outbound call at all is a failure: the gate must return before the
    // pipeline gets as far as talking to a store.
    const realFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      calls++
      return realFetch(...args)
    }) as typeof fetch
    try {
      const result = await syncStockSyncGroups({ userId: id })
      assert.equal(result.writesPlanned, 0)
      assert.equal(result.groupsConsidered, 0)
      assert.deepEqual(result.entries, [])
      assert.equal(calls, 0, 'a gated run must not call a marketplace API')
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('a paid account is NOT short-circuited by the gate', async () => {
    const id = await seedUser({ plan: 'pro', planExpiresAt: ahead(20), trialEndsAt: ago(30) })
    await seedShop(id, 'stock_sync')
    // No products seeded, so there is nothing to write — the point is that the
    // run proceeds to planning instead of returning at the plan check.
    const result = await syncStockSyncGroups({ userId: id })
    assert.equal(result.writesPlanned, 0)
    assert.ok(result.computedAt, 'the run executed')
  })
})
