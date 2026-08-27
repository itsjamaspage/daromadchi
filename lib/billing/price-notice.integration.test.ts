/**
 * Price changes, against a real Postgres.
 *
 * The one thing being proved: NOBODY IS CHARGED AN AMOUNT THEY WERE NOT TOLD
 * ABOUT IN ADVANCE. Every test below is a way that could go wrong — the notice
 * never sent, sent too late, the date arriving early, a re-staged offer reusing
 * an old delivery, a failed charge moving the agreed price anyway — and each one
 * asserts the system falls back to what the seller agreed to.
 *
 * Run: DATABASE_URL=postgres://… npm run test:price-notice
 */
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, pool, users, subscriptions, userSettings } from '@/lib/db'
import {
  stagePriceChange, getPendingPriceChange, dispatchDuePriceNotices,
  renewalAmountTiyin, pendingAmountIsChargeable, promotePendingAmount,
  PRICE_NOTICE_DAYS,
} from './price-notice'
import { cancelPlan } from './cancel'

const DAY = 24 * 60 * 60 * 1000
const ago = (d: number) => new Date(Date.now() - d * DAY)
const ahead = (d: number) => new Date(Date.now() + d * DAY)

/**
 * Stage a change effective EXACTLY PRICE_NOTICE_DAYS out, without racing the
 * clock.
 *
 * stagePriceChange() rejects when `effectiveDate - now < PRICE_NOTICE_DAYS`,
 * and it reads its own `now` unless given one. A test that computes
 * `ahead(PRICE_NOTICE_DAYS)` and then calls it is therefore asking for a gap of
 * exactly 14 days measured from two different instants: it passes only while
 * both land in the same millisecond, and fails the moment a millisecond ticks
 * over between the two statements. That is a coin flip decided by machine
 * load — green on a quiet laptop, red on a busy CI runner, with nothing in the
 * diff to explain it.
 *
 * Pinning one `now` and passing it to both sides keeps the assertion on the
 * exact boundary, which is what these cases are for, while removing the race.
 */
function stageAtNoticeBoundary(subscriptionId: string) {
  const now = new Date()
  return stagePriceChange({
    subscriptionId,
    newAmountTiyin: NEW_PRICE,
    effectiveDate: new Date(now.getTime() + PRICE_NOTICE_DAYS * DAY),
    now,
  })
}

const OLD_PRICE = 15_000_000   // 150 000 so'm
const NEW_PRICE = 25_000_000   // 250 000 so'm

const created: string[] = []

async function seed(opts: { telegram?: boolean; agreed?: number | null; status?: 'active' | 'past_due' } = {}) {
  const userId = randomUUID()
  await db.insert(users).values({
    id: userId, email: `${userId}@price.test`, plan: 'pro', plan_expires_at: ahead(30),
  })
  created.push(userId)

  if (opts.telegram !== false) {
    await db.insert(userSettings).values({ user_id: userId, telegram_chat_id: '111222333', notif_lang: 'ru' })
  }

  const [sub] = await db.insert(subscriptions).values({
    user_id: userId, plan: 'pro', interval: 'monthly', status: opts.status ?? 'active',
    current_period_end: ahead(30),
    agreed_amount_tiyin: opts.agreed === undefined ? OLD_PRICE : opts.agreed,
    card_token_encrypted: 'enc:token',
  }).returning({ id: subscriptions.id })

  return { userId, subscriptionId: sub.id }
}

const readSub = async (id: string) => (await db.select({
  agreed_amount_tiyin: subscriptions.agreed_amount_tiyin,
  pending_amount_tiyin: subscriptions.pending_amount_tiyin,
  pending_effective_date: subscriptions.pending_effective_date,
  pending_notified_at: subscriptions.pending_notified_at,
}).from(subscriptions).where(eq(subscriptions.id, id)))[0]

/** Telegram is stubbed at the network edge so delivery can be made to fail. */
const realFetch = globalThis.fetch
let telegramOk = true
let sent: string[] = []
globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
  const href = String(url)
  if (href.includes('api.telegram.org')) {
    if (init?.body) sent.push(String(init.body))
    return new Response(JSON.stringify({ ok: telegramOk }), {
      status: telegramOk ? 200 : 403, headers: { 'content-type': 'application/json' },
    })
  }
  return realFetch(url as RequestInfo, init)
}) as typeof fetch

after(async () => {
  globalThis.fetch = realFetch
  for (const id of created) await db.delete(users).where(eq(users.id, id))
  await pool.end()
})

describe('staging a price change', () => {
  it('stages the amount and date, and charges nothing yet', async () => {
    const { subscriptionId } = await seed()
    const effective = ahead(30)
    assert.deepEqual(await stagePriceChange({ subscriptionId, newAmountTiyin: NEW_PRICE, effectiveDate: effective }),
      { ok: true, staged: 1 })

    const sub = await readSub(subscriptionId)
    assert.equal(sub.agreed_amount_tiyin, OLD_PRICE, 'the agreed price must not move on staging')
    assert.equal(sub.pending_amount_tiyin, NEW_PRICE)
    assert.equal(sub.pending_notified_at, null)
    assert.equal(renewalAmountTiyin(sub), OLD_PRICE, 'a staged, untold change must not be charged')
  })

  it('refuses a date too close to give real notice', async () => {
    const { subscriptionId } = await seed()
    assert.deepEqual(
      await stagePriceChange({ subscriptionId, newAmountTiyin: NEW_PRICE, effectiveDate: ahead(PRICE_NOTICE_DAYS - 1) }),
      { ok: false, reason: 'notice_too_short' })
  })

  it('refuses something that is not an increase', async () => {
    const { subscriptionId } = await seed()
    assert.deepEqual(
      await stagePriceChange({ subscriptionId, newAmountTiyin: OLD_PRICE, effectiveDate: ahead(30) }),
      { ok: false, reason: 'not_an_increase' })
  })

  it('refuses a subscription that is not live', async () => {
    const { userId, subscriptionId } = await seed()
    await cancelPlan(userId)
    assert.deepEqual(
      await stagePriceChange({ subscriptionId, newAmountTiyin: NEW_PRICE, effectiveDate: ahead(30) }),
      { ok: false, reason: 'no_live_subscription' })
  })

  it('re-staging resets the notice clock', async () => {
    const { subscriptionId } = await seed()
    await stagePriceChange({ subscriptionId, newAmountTiyin: NEW_PRICE, effectiveDate: ahead(30) })
    await db.update(subscriptions).set({ pending_notified_at: ago(20) }).where(eq(subscriptions.id, subscriptionId))

    await stagePriceChange({ subscriptionId, newAmountTiyin: NEW_PRICE + 1_000_000, effectiveDate: ahead(40) })
    const sub = await readSub(subscriptionId)
    assert.equal(sub.pending_notified_at, null,
      'a new offer must not inherit delivery of the old one')
  })
})

describe('the notice sweep', () => {
  it('sends and records delivery once the change is inside the window', async () => {
    telegramOk = true; sent = []
    const { subscriptionId } = await seed()
    await stageAtNoticeBoundary(subscriptionId)

    const result = await dispatchDuePriceNotices()
    assert.ok(result.notified >= 1)
    const sub = await readSub(subscriptionId)
    assert.ok(sub.pending_notified_at, 'delivery must be recorded')
    // The message has to name the amount and the date — that is what makes it notice.
    const body = sent.join('\n')
    assert.match(body, /250 000/, 'the new amount must be named')
  })

  it('records NOTHING when delivery fails — the price then never rises', async () => {
    telegramOk = false; sent = []
    const { subscriptionId } = await seed()
    await stageAtNoticeBoundary(subscriptionId)

    const result = await dispatchDuePriceNotices()
    assert.ok(result.undeliverable >= 1)
    const sub = await readSub(subscriptionId)
    assert.equal(sub.pending_notified_at, null)
    assert.equal(renewalAmountTiyin(sub, ahead(60)), OLD_PRICE,
      'an undelivered increase must never become chargeable, however long passes')
    telegramOk = true
  })

  it('treats an unreachable seller as un-notified', async () => {
    telegramOk = true
    const { subscriptionId } = await seed({ telegram: false })
    await stageAtNoticeBoundary(subscriptionId)

    await dispatchDuePriceNotices()
    assert.equal((await readSub(subscriptionId)).pending_notified_at, null)
  })

  it('does not re-notify someone already told', async () => {
    telegramOk = true
    const { subscriptionId } = await seed()
    await stageAtNoticeBoundary(subscriptionId)
    await dispatchDuePriceNotices()
    const first = (await readSub(subscriptionId)).pending_notified_at

    await dispatchDuePriceNotices()
    assert.equal((await readSub(subscriptionId)).pending_notified_at!.getTime(), first!.getTime())
  })

  it('leaves a change still far out alone', async () => {
    telegramOk = true
    const { subscriptionId } = await seed()
    await stagePriceChange({ subscriptionId, newAmountTiyin: NEW_PRICE, effectiveDate: ahead(PRICE_NOTICE_DAYS + 30) })
    await dispatchDuePriceNotices()
    assert.equal((await readSub(subscriptionId)).pending_notified_at, null,
      'notice is sent as the date approaches, not the moment it is staged')
  })
})

describe('what the renewal charges', () => {
  const base = { agreed_amount_tiyin: OLD_PRICE, pending_amount_tiyin: NEW_PRICE }

  it('the old price while the effective date is still ahead', () => {
    const sub = { ...base, pending_effective_date: ahead(5), pending_notified_at: ago(PRICE_NOTICE_DAYS + 1) }
    assert.equal(pendingAmountIsChargeable(sub), false)
    assert.equal(renewalAmountTiyin(sub), OLD_PRICE)
  })

  it('the old price when the notice is younger than the notice period', () => {
    const sub = { ...base, pending_effective_date: ago(1), pending_notified_at: ago(PRICE_NOTICE_DAYS - 1) }
    assert.equal(pendingAmountIsChargeable(sub), false)
    assert.equal(renewalAmountTiyin(sub), OLD_PRICE, 'notice given too late is not advance notice')
  })

  it('the old price when there is no notice at all', () => {
    const sub = { ...base, pending_effective_date: ago(60), pending_notified_at: null }
    assert.equal(renewalAmountTiyin(sub), OLD_PRICE)
  })

  it('the NEW price once the date has arrived and the notice is old enough', () => {
    const sub = { ...base, pending_effective_date: ago(1), pending_notified_at: ago(PRICE_NOTICE_DAYS + 1) }
    assert.equal(pendingAmountIsChargeable(sub), true)
    assert.equal(renewalAmountTiyin(sub), NEW_PRICE)
  })

  it('falls back to nothing chargeable when there is no agreed price either', () => {
    const sub = { agreed_amount_tiyin: null, pending_amount_tiyin: NEW_PRICE,
      pending_effective_date: ahead(5), pending_notified_at: null }
    assert.equal(renewalAmountTiyin(sub), null, 'the renewal skips rather than guessing')
  })
})

describe('promotion happens only after a successful charge', () => {
  it('moves pending into agreed and clears the staging', async () => {
    const { subscriptionId } = await seed()
    await stagePriceChange({ subscriptionId, newAmountTiyin: NEW_PRICE, effectiveDate: ahead(30) })
    await promotePendingAmount(subscriptionId)

    const sub = await readSub(subscriptionId)
    assert.equal(sub.agreed_amount_tiyin, NEW_PRICE)
    assert.equal(sub.pending_amount_tiyin, null)
    assert.equal(sub.pending_effective_date, null)
    assert.equal(sub.pending_notified_at, null)
  })

  it('is a no-op when there is nothing staged', async () => {
    const { subscriptionId } = await seed()
    await promotePendingAmount(subscriptionId)
    assert.equal((await readSub(subscriptionId)).agreed_amount_tiyin, OLD_PRICE)
  })
})

describe('the seller can get out before the new price lands', () => {
  it('cancelling stops the increase from ever being charged', async () => {
    telegramOk = true
    const { userId, subscriptionId } = await seed()
    await stageAtNoticeBoundary(subscriptionId)
    await dispatchDuePriceNotices()

    // Told, and they say no.
    const cancelled = await cancelPlan(userId)
    assert.equal(cancelled.ok, true)

    // The staged offer stays on the row as a record, but the subscription is no
    // longer live, so no renewal will ever read it.
    const sub = await readSub(subscriptionId)
    assert.equal(sub.pending_amount_tiyin, NEW_PRICE, 'the record of what was offered survives')
    const [status] = await db.select({ status: subscriptions.status })
      .from(subscriptions).where(eq(subscriptions.id, subscriptionId))
    assert.equal(status.status, 'cancelled')
  })

  it('the billing page stops showing the notice once cancelled', async () => {
    telegramOk = true
    const { userId, subscriptionId } = await seed()
    await stagePriceChange({ subscriptionId, newAmountTiyin: NEW_PRICE, effectiveDate: ahead(30) })
    assert.ok(await getPendingPriceChange(userId), 'shown while live')

    await cancelPlan(userId)
    assert.equal(await getPendingPriceChange(userId), null,
      'a cancelled seller must not keep being warned about a price they will never pay')
  })

  it('shows the seller the amount and date while it is still live', async () => {
    const { userId } = await seed()
    const { subscriptionId } = { subscriptionId: (await db.select({ id: subscriptions.id })
      .from(subscriptions).where(eq(subscriptions.user_id, userId)))[0].id }
    const effective = ahead(30)
    await stagePriceChange({ subscriptionId, newAmountTiyin: NEW_PRICE, effectiveDate: effective })

    const notice = await getPendingPriceChange(userId)
    assert.equal(notice!.currentAmountTiyin, OLD_PRICE)
    assert.equal(notice!.newAmountTiyin, NEW_PRICE)
    assert.equal(notice!.effectiveDate.getTime(), effective.getTime())
  })
})
