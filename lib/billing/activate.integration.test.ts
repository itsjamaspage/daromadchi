/**
 * A settled payment must grant the plan it was sold for — every plan, against a
 * real Postgres.
 *
 * This exists because it did not. Checkout would take 500 000 so'm for Biznes,
 * ATMOS would settle it, and applyAtmosPaymentSuccess named `pro` and `pro_plus`
 * by hand, so users.plan was never touched: charged in full, still on free. A
 * unit test with a mocked db would not have caught it, because the bug was the
 * branch that decides whether the UPDATE runs at all.
 *
 * Run: DATABASE_URL=postgres://… node --import tsx --test lib/billing/activate.integration.test.ts
 */
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, pool, users, payments, subscriptions } from '@/lib/db'
import { applyAtmosPaymentSuccess } from './activate'
import { PLAN_PRICES_TIYIN, planAmountTiyin, planPeriodMonths, type PlanKey } from './plans'

const created: string[] = []

async function seedPurchase(plan: string, interval: 'monthly' | 'annual' = 'monthly') {
  const userId = randomUUID()
  await db.insert(users).values({ id: userId, email: `${userId}@activate.test`, plan: 'free' })
  created.push(userId)

  const [sub] = await db.insert(subscriptions).values({
    user_id: userId, plan, interval, status: 'pending',
  }).returning({ id: subscriptions.id })

  const amountTiyin = Object.prototype.hasOwnProperty.call(PLAN_PRICES_TIYIN, plan)
    ? planAmountTiyin(plan as PlanKey, interval)
    : 12_345_600
  const months = Object.prototype.hasOwnProperty.call(PLAN_PRICES_TIYIN, plan)
    ? planPeriodMonths(interval)
    : 1

  const [pay] = await db.insert(payments).values({
    user_id: userId, subscription_id: sub.id, plan, provider: 'atmos',
    amount: String(amountTiyin / 100), amount_tiyin: amountTiyin,
    period_months: months, status: 'pending', atmos_status: 'pending',
  }).returning({ id: payments.id })

  return { userId, subscriptionId: sub.id, paymentId: pay.id, amountTiyin }
}

const readUser = async (id: string) =>
  (await db.select({ plan: users.plan, expires: users.plan_expires_at }).from(users).where(eq(users.id, id)))[0]

describe('a settled payment grants the plan it was sold for', () => {
  after(async () => {
    for (const id of created) await db.delete(users).where(eq(users.id, id))
    await pool.end()
  })

  for (const plan of Object.keys(PLAN_PRICES_TIYIN) as PlanKey[]) {
    it(`${plan} — the seller ends up on ${plan}, not free`, async () => {
      const { userId, paymentId, subscriptionId } = await seedPurchase(plan)

      const result = await applyAtmosPaymentSuccess({ paymentId, source: 'callback' })
      assert.deepEqual(result, { applied: true, outcome: 'activated' })

      const u = await readUser(userId)
      assert.equal(u.plan, plan, `charged for ${plan} and left on ${u.plan}`)
      assert.ok(u.expires && u.expires > new Date(), 'access must run into the future')

      const [s] = await db.select({
        status: subscriptions.status,
        periodEnd: subscriptions.current_period_end,
        agreed: subscriptions.agreed_amount_tiyin,
      }).from(subscriptions).where(eq(subscriptions.id, subscriptionId))
      assert.equal(s.status, 'active')
      assert.equal(s.agreed, planAmountTiyin(plan, 'monthly'), 'the agreed price is what was charged')
      assert.ok(s.periodEnd)
    })
  }

  it('an annual Biznes purchase runs a full year', async () => {
    const { userId, paymentId } = await seedPurchase('biznes', 'annual')
    await applyAtmosPaymentSuccess({ paymentId, source: 'callback' })
    const u = await readUser(userId)
    assert.equal(u.plan, 'biznes')
    const months = (u.expires!.getFullYear() - new Date().getFullYear()) * 12
      + (u.expires!.getMonth() - new Date().getMonth())
    assert.equal(months, 12)
  })

  it('a plan with no price grants nothing — it is not silently upgraded', async () => {
    // 'enterprise' is quote-only: it has no entry in PLAN_PRICES_TIYIN, and the
    // plan_type enum cannot even hold it. A payment carrying it must leave the
    // account alone rather than guess a tier.
    const { userId, paymentId } = await seedPurchase('enterprise')
    const result = await applyAtmosPaymentSuccess({ paymentId, source: 'callback' })
    assert.equal(result.applied, true, 'the payment still settles')
    const u = await readUser(userId)
    assert.equal(u.plan, 'free', 'an unpriced plan must not grant access')
  })

  it('settlement is exactly-once — a replayed callback does not extend access', async () => {
    const { userId, paymentId } = await seedPurchase('biznes')
    await applyAtmosPaymentSuccess({ paymentId, source: 'callback' })
    const first = (await readUser(userId)).expires!

    const replay = await applyAtmosPaymentSuccess({ paymentId, source: 'return' })
    assert.deepEqual(replay, { applied: false, outcome: 'already_final' })
    assert.equal((await readUser(userId)).expires!.getTime(), first.getTime(),
      'a duplicate callback must not buy another month')
  })
})
