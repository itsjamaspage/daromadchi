/**
 * Account freeze and deletion, against a real Postgres.
 *
 * This is the only code in the product that destroys a seller's data, so the
 * assertions are overwhelmingly about NOT acting: not on a paying account, not
 * on one with payment history, not on a NULL timestamp, not without the flag,
 * and not on anyone who has signed in at any point in the ladder. The two
 * positive tests — that a genuinely abandoned account does get frozen, and does
 * get deleted once the flag is on — exist so the negatives cannot pass by the
 * whole thing being broken.
 *
 * Run: DATABASE_URL=postgres://… npm run test:lifecycle
 */
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, pool, users, payments, subscriptions } from '@/lib/db'
import { sweepAccountLifecycle, reactivate, isFrozen, touchLastActive } from './lifecycle'
import {
  INACTIVE_WARN_DAYS, FREEZE_AFTER_WARN_DAYS, DELETE_AFTER_FREEZE_DAYS,
} from './lifecycle-constants'

const DAY = 24 * 60 * 60 * 1000
const ago = (d: number) => new Date(Date.now() - d * DAY)

const created: string[] = []

const realFetch = globalThis.fetch
globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
  if (String(url).includes('api.telegram.org')) {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return realFetch(url as RequestInfo, init)
}) as typeof fetch

async function seed(opts: {
  lastActiveDaysAgo?: number | null
  frozenDaysAgo?: number
  plan?: string
  grandfathered?: boolean
  withPayment?: boolean
  withSubscription?: boolean
} = {}) {
  const id = randomUUID()
  await db.insert(users).values({
    id, email: `${id}@lifecycle.test`,
    plan: (opts.plan ?? 'free') as 'free',
    is_grandfathered: opts.grandfathered ?? false,
    last_active_at: opts.lastActiveDaysAgo == null ? null : ago(opts.lastActiveDaysAgo),
    frozen_at: opts.frozenDaysAgo == null ? null : ago(opts.frozenDaysAgo),
  })
  created.push(id)

  if (opts.withPayment) {
    await db.insert(payments).values({
      user_id: id, plan: 'pro', provider: 'atmos', amount: '150000',
      amount_tiyin: 15_000_000, status: 'paid',
    })
  }
  if (opts.withSubscription) {
    await db.insert(subscriptions).values({
      user_id: id, plan: 'pro', interval: 'monthly', status: 'active',
    })
  }
  return id
}

const alive = async (id: string) =>
  (await db.select({ id: users.id }).from(users).where(eq(users.id, id))).length === 1

const frozenAt = async (id: string) =>
  (await db.select({ f: users.frozen_at }).from(users).where(eq(users.id, id)))[0]?.f ?? null

/** Past every stage of the ladder. */
const ANCIENT = INACTIVE_WARN_DAYS + FREEZE_AFTER_WARN_DAYS + 10

after(async () => {
  globalThis.fetch = realFetch
  for (const id of created) await db.delete(users).where(eq(users.id, id))
  await pool.end()
})

describe('who never gets touched', () => {
  it('an account that has signed in recently', async () => {
    const id = await seed({ lastActiveDaysAgo: 5 })
    await sweepAccountLifecycle()
    assert.equal(await frozenAt(id), null)
    assert.equal(await alive(id), true)
  })

  it('an account with NO last_active_at — unknown is not inactive', async () => {
    const id = await seed({ lastActiveDaysAgo: null })
    await sweepAccountLifecycle()
    assert.equal(await frozenAt(id), null, 'a missing timestamp must never read as a year of silence')
    assert.equal(await alive(id), true)
  })

  it('a PAYING account, however long it has been silent', async () => {
    const id = await seed({ lastActiveDaysAgo: ANCIENT, plan: 'pro' })
    await sweepAccountLifecycle()
    assert.equal(await frozenAt(id), null)
    assert.equal(await alive(id), true)
  })

  it('a free account that has ever paid', async () => {
    const id = await seed({ lastActiveDaysAgo: ANCIENT, frozenDaysAgo: DELETE_AFTER_FREEZE_DAYS + 10, withPayment: true })
    process.env.ACCOUNT_LIFECYCLE_DELETE_ENABLED = '1'
    const result = await sweepAccountLifecycle()
    delete process.env.ACCOUNT_LIFECYCLE_DELETE_ENABLED
    assert.equal(await alive(id), true, 'payment history is a tax record, not ours to delete on a timer')
    assert.ok(result.skippedProtected >= 1)
  })

  it('a free account with a live subscription', async () => {
    const id = await seed({ lastActiveDaysAgo: ANCIENT, frozenDaysAgo: DELETE_AFTER_FREEZE_DAYS + 10, withSubscription: true })
    process.env.ACCOUNT_LIFECYCLE_DELETE_ENABLED = '1'
    await sweepAccountLifecycle()
    delete process.env.ACCOUNT_LIFECYCLE_DELETE_ENABLED
    assert.equal(await alive(id), true)
  })

  it('a grandfathered account', async () => {
    const id = await seed({ lastActiveDaysAgo: ANCIENT, frozenDaysAgo: DELETE_AFTER_FREEZE_DAYS + 10, grandfathered: true })
    process.env.ACCOUNT_LIFECYCLE_DELETE_ENABLED = '1'
    await sweepAccountLifecycle()
    delete process.env.ACCOUNT_LIFECYCLE_DELETE_ENABLED
    assert.equal(await alive(id), true)
  })
})

describe('the ladder', () => {
  it('warns after a year, and does not freeze yet', async () => {
    const id = await seed({ lastActiveDaysAgo: INACTIVE_WARN_DAYS + 1 })
    const result = await sweepAccountLifecycle()
    assert.ok(result.warned >= 1)
    assert.equal(await frozenAt(id), null, 'the warning comes first, on its own')
  })

  it('warns once, not every day the sweep runs', async () => {
    const id = await seed({ lastActiveDaysAgo: INACTIVE_WARN_DAYS + 1 })
    const first = await sweepAccountLifecycle()
    const second = await sweepAccountLifecycle()
    assert.ok(first.warned >= 1)
    // The second pass must not re-warn this account; the notice row is claimed.
    const rows = await db.execute(
      `SELECT count(*)::int AS n FROM user_notices WHERE user_id = '${id}' AND kind = 'inactivity_warning'`,
    )
    assert.equal((rows.rows[0] as { n: number }).n, 1)
    void second
  })

  it('freezes once the warning window has also passed', async () => {
    const id = await seed({ lastActiveDaysAgo: INACTIVE_WARN_DAYS + FREEZE_AFTER_WARN_DAYS + 1 })
    const result = await sweepAccountLifecycle()
    assert.ok(result.frozen >= 1)
    assert.ok(await frozenAt(id), 'frozen')
    assert.equal(await alive(id), true, 'freezing destroys nothing')
  })

  it('does NOT delete a frozen account before its window is up', async () => {
    const id = await seed({ lastActiveDaysAgo: ANCIENT, frozenDaysAgo: DELETE_AFTER_FREEZE_DAYS - 5 })
    process.env.ACCOUNT_LIFECYCLE_DELETE_ENABLED = '1'
    await sweepAccountLifecycle()
    delete process.env.ACCOUNT_LIFECYCLE_DELETE_ENABLED
    assert.equal(await alive(id), true)
  })
})

describe('deletion is off unless it is switched on', () => {
  it('reports what it WOULD delete and deletes nothing', async () => {
    delete process.env.ACCOUNT_LIFECYCLE_DELETE_ENABLED
    const id = await seed({ lastActiveDaysAgo: ANCIENT, frozenDaysAgo: DELETE_AFTER_FREEZE_DAYS + 10 })
    const result = await sweepAccountLifecycle()
    assert.equal(result.dryRun, true)
    assert.ok(result.deletable >= 1, 'it names the candidate')
    assert.equal(result.deleted, 0, 'and deletes nobody')
    assert.equal(await alive(id), true)
  })

  it('deletes only with the flag on, and only the abandoned account', async () => {
    const doomed = await seed({ lastActiveDaysAgo: ANCIENT, frozenDaysAgo: DELETE_AFTER_FREEZE_DAYS + 10 })
    const bystander = await seed({ lastActiveDaysAgo: 2 })

    process.env.ACCOUNT_LIFECYCLE_DELETE_ENABLED = '1'
    const result = await sweepAccountLifecycle()
    delete process.env.ACCOUNT_LIFECYCLE_DELETE_ENABLED

    assert.equal(result.dryRun, false)
    assert.ok(result.deleted >= 1)
    assert.equal(await alive(doomed), false)
    assert.equal(await alive(bystander), true)
  })
})

describe('coming back', () => {
  it('a sign-in takes an account out of every stage at once', async () => {
    const id = await seed({ lastActiveDaysAgo: INACTIVE_WARN_DAYS + FREEZE_AFTER_WARN_DAYS + 1 })
    await sweepAccountLifecycle()
    assert.ok(await frozenAt(id))

    await reactivate(id)
    assert.equal(await isFrozen(id), false)

    // And the clock restarted: another sweep must not re-freeze them.
    await sweepAccountLifecycle()
    assert.equal(await frozenAt(id), null)
  })

  it('touchLastActive alone stops the ladder before it starts', async () => {
    const id = await seed({ lastActiveDaysAgo: INACTIVE_WARN_DAYS + 1 })
    await touchLastActive(id)
    const result = await sweepAccountLifecycle()
    assert.equal(result.warned, 0)
  })
})
