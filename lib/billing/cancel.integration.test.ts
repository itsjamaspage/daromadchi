/**
 * Cancelling a plan, against a real Postgres.
 *
 * The contract being pinned: a cancel STOPS THE NEXT CHARGE and KEEPS what was
 * already paid for. Those two must both hold — a cancel that also revoked
 * access would take back a period the seller bought, and a cancel that left the
 * renewal query able to match the row would charge someone who ended their
 * subscription. Both are money bugs, so both are asserted against real rows,
 * including a replay of the renewal cron's own selection.
 *
 * Run: DATABASE_URL=postgres://… npm run test:cancel
 */
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { and, eq, inArray, isNotNull, lt } from 'drizzle-orm'
import { db, pool, users, subscriptions } from '@/lib/db'
import { cancelPlan, resumePlan, getCancellationState } from './cancel'

const DAY = 24 * 60 * 60 * 1000
const ago = (d: number) => new Date(Date.now() - d * DAY)
const ahead = (d: number) => new Date(Date.now() + d * DAY)

const created: string[] = []

async function seed(opts: {
  plan?: string
  planExpiresAt?: Date | null
  subs?: { status: 'active' | 'past_due' | 'pending' | 'cancelled'; periodEnd?: Date | null; token?: boolean }[]
}) {
  const userId = randomUUID()
  await db.insert(users).values({
    id: userId, email: `${userId}@cancel.test`,
    plan: (opts.plan ?? 'pro') as 'pro',
    // `?? ahead(20)` would turn an explicitly-null expiry back into a date, so
    // the "nothing was ever paid for" case must distinguish absent from null.
    plan_expires_at: 'planExpiresAt' in opts ? opts.planExpiresAt : ahead(20),
  })
  created.push(userId)

  for (const sub of opts.subs ?? [{ status: 'active', periodEnd: ahead(20), token: true }]) {
    await db.insert(subscriptions).values({
      user_id: userId, plan: 'pro', interval: 'monthly', status: sub.status,
      current_period_end: sub.periodEnd ?? null,
      agreed_amount_tiyin: 15_000_000,
      card_token_encrypted: sub.token === false ? null : 'enc:token',
    })
  }
  return userId
}

const account = async (id: string) =>
  (await db.select({ plan: users.plan, expires: users.plan_expires_at }).from(users).where(eq(users.id, id)))[0]

const subsOf = (id: string) => db.select({
  status: subscriptions.status, autorenew: subscriptions.autorenew,
  cancelledAt: subscriptions.cancelled_at, accessUntil: subscriptions.access_until,
  token: subscriptions.card_token_encrypted,
}).from(subscriptions).where(eq(subscriptions.user_id, id))

/**
 * The renewal cron's selection, copied from app/api/cron/billing-renew. If a
 * cancelled subscription can still match this, it gets charged.
 */
function renewable(userId: string) {
  return db.select({ id: subscriptions.id }).from(subscriptions).where(and(
    eq(subscriptions.user_id, userId),
    inArray(subscriptions.status, ['active', 'past_due']),
    eq(subscriptions.autorenew, true),
    isNotNull(subscriptions.card_token_encrypted),
    lt(subscriptions.current_period_end, ahead(1)),
  ))
}

after(async () => {
  for (const id of created) await db.delete(users).where(eq(users.id, id))
  await pool.end()
})

describe('cancelling stops the charge and keeps the paid period', () => {
  it('records the cancellation and the promised access date', async () => {
    const periodEnd = ahead(20)
    const id = await seed({ subs: [{ status: 'active', periodEnd }] })

    const result = await cancelPlan(id)
    assert.equal(result.ok, true)
    assert.ok(result.ok && result.state.accessUntil)
    assert.equal(result.ok && result.state.accessUntil!.getTime(), periodEnd.getTime())
    assert.equal(result.ok && result.state.stillActive, true)

    const [sub] = await subsOf(id)
    assert.equal(sub.status, 'cancelled')
    assert.equal(sub.autorenew, false)
    assert.ok(sub.cancelledAt)
    assert.equal(sub.accessUntil!.getTime(), periodEnd.getTime())
  })

  it('does NOT revoke access — the seller keeps what they paid for', async () => {
    const expires = ahead(20)
    const id = await seed({ plan: 'pro', planExpiresAt: expires })
    await cancelPlan(id)

    const a = await account(id)
    assert.equal(a.plan, 'pro', 'cancelling must not downgrade the plan')
    assert.equal(a.expires!.getTime(), expires.getTime(), 'cancelling must not move the expiry')
  })

  it('makes the row unselectable by the renewal cron', async () => {
    // Due tomorrow, card on file: this is exactly the row the cron charges.
    const id = await seed({ subs: [{ status: 'active', periodEnd: ahead(0.5), token: true }] })
    assert.equal((await renewable(id)).length, 1, 'precondition: this row would be charged')

    await cancelPlan(id)
    assert.equal((await renewable(id)).length, 0, 'a cancelled subscription must never be charged')
  })

  it('cancels every live subscription, not just one', async () => {
    const id = await seed({ subs: [
      { status: 'active', periodEnd: ahead(10) },
      { status: 'past_due', periodEnd: ahead(30) },
      { status: 'pending', periodEnd: null },
    ] })

    const result = await cancelPlan(id)
    assert.ok(result.ok)
    const rows = await subsOf(id)
    assert.equal(rows.length, 3)
    assert.ok(rows.every(r => r.status === 'cancelled' && r.autorenew === false),
      'a second live subscription left renewing would charge a seller who cancelled')
    // The promise is the furthest date any of them covered.
    assert.equal(result.ok && result.state.accessUntil!.getTime(), rows
      .map(r => r.accessUntil!.getTime()).sort((a, b) => b - a)[0])
  })

  it('falls back to the account expiry when a subscription has no period end', async () => {
    const expires = ahead(9)
    const id = await seed({ planExpiresAt: expires, subs: [{ status: 'active', periodEnd: null }] })
    const result = await cancelPlan(id)
    assert.equal(result.ok && result.state.accessUntil!.getTime(), expires.getTime())
  })

  it('records NULL access when nothing was ever paid for', async () => {
    const id = await seed({ plan: 'free', planExpiresAt: null, subs: [{ status: 'pending', periodEnd: null }] })
    const result = await cancelPlan(id)
    assert.ok(result.ok)
    assert.equal(result.ok && result.state.accessUntil, null)
    assert.equal(result.ok && result.state.stillActive, false)
  })

  it('refuses when there is nothing live to cancel', async () => {
    const id = await seed({ plan: 'free', planExpiresAt: null, subs: [] })
    assert.deepEqual(await cancelPlan(id), { ok: false, reason: 'nothing_to_cancel' })
  })

  it('is idempotent — cancelling twice is not an error the second time', async () => {
    const id = await seed({})
    assert.equal((await cancelPlan(id)).ok, true)
    // Nothing live remains, so the second press is refused rather than
    // overwriting the original cancellation date.
    const second = await cancelPlan(id)
    assert.deepEqual(second, { ok: false, reason: 'nothing_to_cancel' })
    const [sub] = await subsOf(id)
    assert.ok(sub.cancelledAt, 'the first cancellation survives')
  })

  it('keeps the card token, so resuming does not need it re-entered', async () => {
    const id = await seed({})
    await cancelPlan(id)
    const [sub] = await subsOf(id)
    assert.equal(sub.token, 'enc:token')
  })
})

describe('the state the billing page reads', () => {
  it('reports the cancellation while the period is still running', async () => {
    const id = await seed({ subs: [{ status: 'active', periodEnd: ahead(5) }] })
    await cancelPlan(id)
    const state = await getCancellationState(id)
    assert.equal(state.cancelled, true)
    assert.equal(state.stillActive, true)
  })

  it('reports it as over once the promised date has passed', async () => {
    const id = await seed({ planExpiresAt: ago(1), subs: [{ status: 'active', periodEnd: ago(1) }] })
    await cancelPlan(id)
    const state = await getCancellationState(id)
    assert.equal(state.cancelled, true)
    assert.equal(state.stillActive, false, 'an expired period must not read as still active')
  })

  it('is silent for an account that never cancelled', async () => {
    const id = await seed({})
    assert.deepEqual(await getCancellationState(id),
      { cancelled: false, cancelledAt: null, accessUntil: null, stillActive: false })
  })
})

describe('resuming', () => {
  it('puts the subscription and its renewal back', async () => {
    const id = await seed({ subs: [{ status: 'active', periodEnd: ahead(0.5), token: true }] })
    await cancelPlan(id)
    assert.deepEqual(await resumePlan(id), { ok: true })

    const [sub] = await subsOf(id)
    assert.equal(sub.status, 'active')
    assert.equal(sub.autorenew, true)
    assert.equal(sub.cancelledAt, null)
    assert.equal(sub.accessUntil, null)
    assert.equal((await renewable(id)).length, 1, 'the renewal is live again')
  })

  it('refuses once the paid period is over — that needs a fresh checkout', async () => {
    const id = await seed({ planExpiresAt: ago(2), subs: [{ status: 'active', periodEnd: ago(2) }] })
    await cancelPlan(id)
    assert.deepEqual(await resumePlan(id), { ok: false, reason: 'period_over' })
    const [sub] = await subsOf(id)
    assert.equal(sub.status, 'cancelled', 'a lapsed subscription must not be silently revived')
  })

  it('refuses when nothing was cancelled', async () => {
    const id = await seed({})
    assert.deepEqual(await resumePlan(id), { ok: false, reason: 'nothing_to_resume' })
  })
})
