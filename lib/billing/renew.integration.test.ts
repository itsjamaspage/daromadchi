/**
 * The recurring-charge harness.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * Auto-renewal is the only code path in the product that takes money with no
 * human present. It has never run for real — BILLING_AUTORENEW_ENABLED is off
 * and direct charging is still blocked on ATMOS `unknown_account` — so the day
 * it is switched on, it will meet live cards having been proven by nothing but
 * reading. This is the proof instead: the real loop, a real Postgres, and a
 * fake gateway standing in for ATMOS.
 *
 * ── The rule every test below serves ────────────────────────────────────────
 * A seller is charged the amount they agreed to, once, or not at all. Every
 * uncertainty resolves toward NOT charging: an unknown plan, a missing agreed
 * price, an increase that was never announced, a subscription someone
 * cancelled. Missing a renewal is recoverable — the seller pays again. A wrong
 * charge is a refund and a complaint.
 *
 * ── What the fake is allowed to do ──────────────────────────────────────────
 * Only what ATMOS can do: hand back a transaction id, or throw. It cannot
 * "succeed differently". It also reproduces the ordering that matters — the
 * transaction id arrives from pay/create BEFORE pay/apply decides, so a charge
 * can fail with the id already persisted, which is exactly the state an
 * operator has to reconcile by hand.
 *
 * Run against a THROWAWAY database:
 *   DATABASE_URL=postgres://…/scratch npm run test:renew
 */
import { describe, it, before, afterEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { and, eq, inArray, isNotNull, lt } from 'drizzle-orm'
import { db, pool, users, payments, subscriptions } from '@/lib/db'
import { runBillingRenewal, RENEW_WINDOW_MS, GRACE_MS, type ChargeFn } from './renew'
import { PLAN_PRICES_TIYIN } from './plans'
import { PRICE_NOTICE_DAYS } from './price-notice'

const DAY = 24 * 60 * 60 * 1000
const ago = (d: number) => new Date(Date.now() - d * DAY)
const ahead = (d: number) => new Date(Date.now() + d * DAY)

/**
 * Deliberately unlike any configured price. If a charge ever comes out equal to
 * PLAN_PRICES_TIYIN, the agreed-price rule has broken and the assertion says so
 * by the number alone.
 */
const AGREED = 5_000_000        //  50 000 so'm — the pricing-test subscription
const RAISED = 25_000_000       // 250 000 so'm — a staged increase

const TOKEN = 'enc:fake-card-token'
const created: string[] = []

/* ── the fake gateway ─────────────────────────────────────────────────────── */

type FailPoint = 'none' | 'create' | 'apply'

function gateway(failAt: FailPoint = 'none') {
  const calls: { account: string; amountTiyin: number; token: string }[] = []
  const charge: ChargeFn = async (account, amountTiyin, cardToken, onCreated) => {
    calls.push({ account, amountTiyin, token: cardToken })
    // pay/create can fail before any transaction exists.
    if (failAt === 'create') throw new Error('atmos: create failed')
    const transactionId = `txn_${randomUUID().slice(0, 8)}`
    if (onCreated) await onCreated(transactionId)
    // pay/apply fails with the id already ours — the reconcilable case.
    if (failAt === 'apply') throw new Error('atmos: apply declined')
    return { transactionId }
  }
  return { charge, calls }
}

/** The only decryptor these tests use: production's is proven in lib/crypto. */
const decryptToken = (enc: string) => enc.replace(/^enc:/, '')

/* ── seeding ──────────────────────────────────────────────────────────────── */

interface SeedOpts {
  plan?: string
  /**
   * subscriptions.plan when it differs from the user's. It is free TEXT while
   * users.plan is an enum, so a subscription can legitimately carry a string
   * checkout no longer sells — which is the case worth testing.
   */
  subPlan?: string
  interval?: 'monthly' | 'annual'
  status?: 'active' | 'past_due' | 'cancelled' | 'expired'
  /** Days from now the current period ends. Negative = already overdue. */
  endsInDays?: number
  agreed?: number | null
  autorenew?: boolean
  token?: string | null
  pending?: { amount: number; effective: Date; notifiedAt: Date | null }
}

async function seed(opts: SeedOpts = {}) {
  const endsAt = ahead(opts.endsInDays ?? 0.5)
  const userId = randomUUID()
  await db.insert(users).values({
    id: userId, email: `${userId}@renew.test`,
    plan: opts.plan ?? 'pro', plan_expires_at: endsAt,
  })
  created.push(userId)

  const [sub] = await db.insert(subscriptions).values({
    user_id: userId,
    plan: opts.subPlan ?? opts.plan ?? 'pro',
    interval: opts.interval ?? 'monthly',
    status: opts.status ?? 'active',
    current_period_end: endsAt,
    agreed_amount_tiyin: opts.agreed === undefined ? AGREED : opts.agreed,
    autorenew: opts.autorenew ?? true,
    card_token_encrypted: opts.token === undefined ? TOKEN : opts.token,
    pending_amount_tiyin: opts.pending?.amount ?? null,
    pending_effective_date: opts.pending?.effective ?? null,
    pending_notified_at: opts.pending?.notifiedAt ?? null,
  }).returning({ id: subscriptions.id })

  return { userId, subscriptionId: sub.id, endsAt }
}

const readSub = async (id: string) => (await db.select().from(subscriptions).where(eq(subscriptions.id, id)))[0]
const readUser = async (id: string) => (await db.select().from(users).where(eq(users.id, id)))[0]
const paymentsFor = async (subId: string) =>
  db.select().from(payments).where(eq(payments.subscription_id, subId))

/* ── guard: counts only mean something on an empty table ──────────────────── */

before(async () => {
  const leftover = await db.select({ id: subscriptions.id }).from(subscriptions).where(and(
    inArray(subscriptions.status, ['active', 'past_due']),
    eq(subscriptions.autorenew, true),
    isNotNull(subscriptions.card_token_encrypted),
    lt(subscriptions.current_period_end, new Date(Date.now() + RENEW_WINDOW_MS)),
  ))
  assert.equal(leftover.length, 0,
    `${leftover.length} subscription(s) are already due for renewal in this database. ` +
    'This harness asserts on whole-pass counts, so it must run against a THROWAWAY ' +
    'database — point DATABASE_URL somewhere disposable and re-run.')
})

afterEach(async () => {
  while (created.length) {
    const id = created.pop() as string
    await db.delete(payments).where(eq(payments.user_id, id))
    await db.delete(users).where(eq(users.id, id))   // cascades to subscriptions
  }
})

after(async () => { await pool.end() })

/* ────────────────────────────────────────────────────────────────────────── */

describe('recurring charge — what it bills', () => {
  it('charges the agreed price, never the configured one', async () => {
    const { subscriptionId } = await seed()
    const g = gateway()

    const out = await runBillingRenewal({ charge: g.charge, decryptToken })

    assert.equal(out.charged, 1)
    assert.equal(g.calls.length, 1)
    assert.equal(g.calls[0].amountTiyin, AGREED)
    assert.notEqual(g.calls[0].amountTiyin, PLAN_PRICES_TIYIN.pro.monthly,
      'the renewal billed the live config price — the agreed-price rule is broken')
    const [pay] = await paymentsFor(subscriptionId)
    assert.equal(pay.amount_tiyin, AGREED)
  })

  it('never charges a subscription with no agreed price', async () => {
    const { subscriptionId } = await seed({ agreed: null })
    const g = gateway()

    const out = await runBillingRenewal({ charge: g.charge, decryptToken })

    assert.equal(out.noAgreedAmount, 1)
    assert.equal(out.charged, 0)
    assert.equal(g.calls.length, 0, 'a card was charged an amount nobody agreed to')
    assert.equal((await paymentsFor(subscriptionId)).length, 0,
      'a payment row was created for a charge that must never be attempted')
  })

  it('never charges a zero agreed price', async () => {
    await seed({ agreed: 0 })
    const g = gateway()
    const out = await runBillingRenewal({ charge: g.charge, decryptToken })
    assert.equal(out.noAgreedAmount, 1)
    assert.equal(g.calls.length, 0)
  })

  it('renews every plan checkout can sell, Biznes included', async () => {
    // The regression: this loop once named pro and pro_plus by hand, so a
    // Biznes subscriber paying 500 000 so'm was silently never charged again.
    for (const plan of Object.keys(PLAN_PRICES_TIYIN)) {
      const { subscriptionId } = await seed({ plan })
      const g = gateway()

      const out = await runBillingRenewal({ charge: g.charge, decryptToken })

      assert.equal(out.charged, 1, `${plan} was not renewed`)
      assert.equal(out.skipped, 0, `${plan} was treated as unsellable`)
      const [pay] = await paymentsFor(subscriptionId)
      assert.equal(pay.plan, plan)
      // Clean between plans so each pass sees exactly one due subscription.
      const id = created.pop() as string
      await db.delete(payments).where(eq(payments.user_id, id))
      await db.delete(users).where(eq(users.id, id))
    }
  })

  it('skips a plan string checkout cannot sell rather than guessing a price', async () => {
    await seed({ subPlan: 'legacy_gold' })
    const g = gateway()

    const out = await runBillingRenewal({ charge: g.charge, decryptToken })

    assert.equal(out.skipped, 1)
    assert.equal(out.charged, 0)
    assert.equal(g.calls.length, 0)
  })

  it('bills an annual subscription its annual agreed amount for twelve months', async () => {
    const annualAgreed = 50_000_000
    const { subscriptionId, endsAt } = await seed({ interval: 'annual', agreed: annualAgreed })
    const g = gateway()

    await runBillingRenewal({ charge: g.charge, decryptToken })

    assert.equal(g.calls[0].amountTiyin, annualAgreed)
    const [pay] = await paymentsFor(subscriptionId)
    assert.equal(pay.period_months, 12)
    const expected = new Date(endsAt); expected.setMonth(expected.getMonth() + 12)
    const sub = await readSub(subscriptionId)
    assert.equal(sub.current_period_end?.toISOString(), expected.toISOString())
  })
})

describe('recurring charge — who it selects', () => {
  it('leaves a subscription whose period is beyond the window alone', async () => {
    await seed({ endsInDays: 10 })
    const g = gateway()
    const out = await runBillingRenewal({ charge: g.charge, decryptToken })
    assert.equal(out.due, 0)
    assert.equal(g.calls.length, 0)
  })

  it('does not charge a seller who turned autorenew off', async () => {
    await seed({ autorenew: false })
    const g = gateway()
    const out = await runBillingRenewal({ charge: g.charge, decryptToken })
    assert.equal(out.due, 0)
    assert.equal(g.calls.length, 0)
  })

  it('does not charge a cancelled subscription', async () => {
    // Cancellation keeps access to the end of the paid period and then stops.
    // Charging one again bills someone who withdrew the authorisation.
    await seed({ status: 'cancelled' })
    const g = gateway()
    const out = await runBillingRenewal({ charge: g.charge, decryptToken })
    assert.equal(out.due, 0)
    assert.equal(g.calls.length, 0)
  })

  it('does not charge an expired subscription', async () => {
    await seed({ status: 'expired', endsInDays: -30 })
    const g = gateway()
    const out = await runBillingRenewal({ charge: g.charge, decryptToken })
    assert.equal(out.due, 0)
    assert.equal(g.calls.length, 0)
  })

  it('skips a subscription with no bound card', async () => {
    await seed({ token: null })
    const g = gateway()
    const out = await runBillingRenewal({ charge: g.charge, decryptToken })
    assert.equal(out.due, 0)
    assert.equal(g.calls.length, 0)
  })

  it('retries a past_due subscription', async () => {
    await seed({ status: 'past_due', endsInDays: -1 })
    const g = gateway()
    const out = await runBillingRenewal({ charge: g.charge, decryptToken })
    assert.equal(out.charged, 1)
  })
})

describe('recurring charge — a successful renewal', () => {
  it('settles the payment, extends the period and moves the plan expiry', async () => {
    const { userId, subscriptionId, endsAt } = await seed()
    const g = gateway()

    await runBillingRenewal({ charge: g.charge, decryptToken })

    const [pay] = await paymentsFor(subscriptionId)
    assert.equal(pay.atmos_status, 'success')
    assert.equal(pay.status, 'paid')
    assert.ok(pay.atmos_transaction_id, 'the transaction id was not recorded')

    // Anchored on the EXISTING expiry, not on now — a renewal adds a month, it
    // does not shorten an unexpired plan to today + 1 month.
    const expected = new Date(endsAt); expected.setMonth(expected.getMonth() + 1)
    const sub = await readSub(subscriptionId)
    assert.equal(sub.status, 'active')
    assert.equal(sub.current_period_end?.toISOString(), expected.toISOString())

    const user = await readUser(userId)
    assert.equal(user.plan, 'pro')
    assert.equal(user.plan_expires_at?.toISOString(), expected.toISOString())
  })

  it('does not charge the same subscription twice on a second pass', async () => {
    // The renewal ran; the period moved out of the window. A cron that fires
    // again an hour later — or twice by accident — must find nothing to do.
    const { subscriptionId } = await seed()
    const g = gateway()

    await runBillingRenewal({ charge: g.charge, decryptToken })
    const second = await runBillingRenewal({ charge: g.charge, decryptToken })

    assert.equal(second.due, 0)
    assert.equal(g.calls.length, 1, 'the card was charged twice')
    assert.equal((await paymentsFor(subscriptionId)).length, 1)
  })
})

describe('recurring charge — a failed renewal', () => {
  it('marks past_due and keeps access inside the grace period', async () => {
    const { userId, subscriptionId } = await seed({ endsInDays: -1 })
    const g = gateway('apply')

    const out = await runBillingRenewal({ charge: g.charge, decryptToken })

    assert.equal(out.failed, 1)
    assert.equal(out.downgraded, 0)
    const [pay] = await paymentsFor(subscriptionId)
    assert.equal(pay.status, 'failed')
    assert.equal(pay.atmos_status, 'failed')
    const sub = await readSub(subscriptionId)
    assert.equal(sub.status, 'past_due')
    assert.equal((await readUser(userId)).plan, 'pro', 'access was pulled while still in grace')
  })

  it('drops to free past the grace period but keeps the card token', async () => {
    const overdueDays = GRACE_MS / DAY + 1
    const { userId, subscriptionId } = await seed({ endsInDays: -overdueDays })
    const g = gateway('apply')

    const out = await runBillingRenewal({ charge: g.charge, decryptToken })

    assert.equal(out.downgraded, 1)
    assert.equal((await readUser(userId)).plan, 'free')
    const sub = await readSub(subscriptionId)
    assert.equal(sub.status, 'past_due')
    assert.equal(sub.card_token_encrypted, TOKEN,
      'the card token was discarded — a later run can no longer recover the subscription')
  })

  it('keeps the transaction id when the charge dies after create', async () => {
    // pay/create succeeded, pay/apply did not. Whether money moved is unknown
    // from here; the id is the only handle an operator has to find out.
    const { subscriptionId } = await seed({ endsInDays: -1 })
    const g = gateway('apply')

    await runBillingRenewal({ charge: g.charge, decryptToken })

    const [pay] = await paymentsFor(subscriptionId)
    assert.ok(pay.atmos_payment_id, 'a half-finished charge left no id to reconcile against')
    assert.equal(pay.status, 'failed')
  })

  it('records a failure that never reached a transaction at all', async () => {
    const { subscriptionId } = await seed({ endsInDays: -1 })
    const g = gateway('create')

    const out = await runBillingRenewal({ charge: g.charge, decryptToken })

    assert.equal(out.failed, 1)
    const [pay] = await paymentsFor(subscriptionId)
    assert.equal(pay.atmos_payment_id, null)
    assert.equal(pay.status, 'failed')
  })
})

describe('recurring charge — a staged price increase', () => {
  const notified = (daysAgo: number) => ago(daysAgo)

  it('charges the new price once the seller was told, long enough ago', async () => {
    const { subscriptionId } = await seed({
      pending: { amount: RAISED, effective: ago(1), notifiedAt: notified(PRICE_NOTICE_DAYS + 1) },
    })
    const g = gateway()

    await runBillingRenewal({ charge: g.charge, decryptToken })

    assert.equal(g.calls[0].amountTiyin, RAISED)
    const sub = await readSub(subscriptionId)
    assert.equal(sub.agreed_amount_tiyin, RAISED, 'the new price was charged but not promoted')
    assert.equal(sub.pending_amount_tiyin, null)
    assert.equal(sub.pending_notified_at, null)
  })

  it('charges the old price when the notice was never delivered', async () => {
    // The effective date passing does not make an unannounced increase
    // chargeable. Time is not consent.
    const { subscriptionId } = await seed({
      pending: { amount: RAISED, effective: ago(30), notifiedAt: null },
    })
    const g = gateway()

    await runBillingRenewal({ charge: g.charge, decryptToken })

    assert.equal(g.calls[0].amountTiyin, AGREED)
    const sub = await readSub(subscriptionId)
    assert.equal(sub.agreed_amount_tiyin, AGREED)
    assert.equal(sub.pending_amount_tiyin, RAISED, 'the standing offer was dropped')
  })

  it('charges the old price when the notice is too recent', async () => {
    const { subscriptionId } = await seed({
      pending: { amount: RAISED, effective: ago(1), notifiedAt: notified(1) },
    })
    const g = gateway()

    await runBillingRenewal({ charge: g.charge, decryptToken })

    assert.equal(g.calls[0].amountTiyin, AGREED)
    assert.equal((await readSub(subscriptionId)).agreed_amount_tiyin, AGREED)
  })

  it('charges the old price before the effective date arrives', async () => {
    const { subscriptionId } = await seed({
      pending: { amount: RAISED, effective: ahead(20), notifiedAt: notified(PRICE_NOTICE_DAYS + 1) },
    })
    const g = gateway()

    await runBillingRenewal({ charge: g.charge, decryptToken })

    assert.equal(g.calls[0].amountTiyin, AGREED)
    assert.equal((await readSub(subscriptionId)).agreed_amount_tiyin, AGREED)
  })

  it('does not promote the new price when the charge fails', async () => {
    // Promoting on the strength of an attempt would leave the seller agreed to
    // a number they never paid — and the next run would charge it with the
    // notice already consumed.
    const { subscriptionId } = await seed({
      endsInDays: -1,
      pending: { amount: RAISED, effective: ago(1), notifiedAt: notified(PRICE_NOTICE_DAYS + 1) },
    })
    const g = gateway('apply')

    await runBillingRenewal({ charge: g.charge, decryptToken })

    const sub = await readSub(subscriptionId)
    assert.equal(sub.agreed_amount_tiyin, AGREED)
    assert.equal(sub.pending_amount_tiyin, RAISED)
    assert.ok(sub.pending_notified_at, 'the delivered notice was cleared by a failed charge')
  })
})

describe('recurring charge — dry run', () => {
  it('reports what is due and touches nothing', async () => {
    const { userId, subscriptionId, endsAt } = await seed()
    const g = gateway()

    const out = await runBillingRenewal({ charge: g.charge, decryptToken, dryRun: true })

    assert.equal(out.dryRun, true)
    assert.equal(out.due, 1)
    assert.equal(out.charged, 0)
    assert.equal(g.calls.length, 0, 'a dry run reached the gateway')
    assert.equal((await paymentsFor(subscriptionId)).length, 0)
    const sub = await readSub(subscriptionId)
    assert.equal(sub.current_period_end?.toISOString(), endsAt.toISOString())
    assert.equal((await readUser(userId)).plan_expires_at?.toISOString(), endsAt.toISOString())
  })
})
