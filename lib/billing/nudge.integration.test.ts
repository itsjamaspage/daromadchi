/**
 * Free-tier nudges, against a real Postgres.
 *
 * A nudge is a suggestion, so the risk here is not overcharging — it is noise
 * and wrong facts. The sweep runs daily, so the assertions are mostly about NOT
 * sending: not twice, not to a paying account, not to someone who never had a
 * trial, and not on a stale turnover figure. The one thing it must always do is
 * tell a seller before their trial ends, which is the promise the help articles
 * make again now that this exists.
 *
 * Run: DATABASE_URL=postgres://… npm run test:nudge
 */
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db, pool, users, userSettings, userNotices } from '@/lib/db'
import {
  dispatchTierNudges, getActiveNotice, dismissNotice,
  TRIAL_REMINDER_DAYS, RENUDGE_DAYS,
} from './nudge'
import { ENTERPRISE_POPUP_THRESHOLD } from './tiers'
import { ADMIN_CHAT_IDS } from '@/lib/telegram-admin'

const DAY = 24 * 60 * 60 * 1000
const ago = (d: number) => new Date(Date.now() - d * DAY)
const ahead = (d: number) => new Date(Date.now() + d * DAY)

const created: string[] = []
let sent: string[] = []

const realFetch = globalThis.fetch
globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
  if (String(url).includes('api.telegram.org')) {
    if (init?.body) sent.push(String(init.body))
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return realFetch(url as RequestInfo, init)
}) as typeof fetch

async function seed(opts: {
  plan?: string
  trialEndsAt?: Date | null
  derivedTier?: string | null
  turnoverSom?: number | null
  telegram?: boolean
} = {}) {
  const id = randomUUID()
  await db.insert(users).values({
    id, email: `${id}@nudge.test`,
    plan: (opts.plan ?? 'free') as 'free',
    trial_ends_at: 'trialEndsAt' in opts ? opts.trialEndsAt : null,
    derived_tier: opts.derivedTier ?? null,
    derived_turnover_som: opts.turnoverSom == null ? null : String(opts.turnoverSom),
  })
  created.push(id)
  if (opts.telegram !== false) {
    await db.insert(userSettings).values({ user_id: id, telegram_chat_id: `chat-${id}`, notif_lang: 'ru' })
  }
  return id
}

const noticesOf = (id: string) => db.select({
  kind: userNotices.kind, sentAt: userNotices.sent_at,
  dismissedAt: userNotices.dismissed_at, detail: userNotices.detail,
}).from(userNotices).where(eq(userNotices.user_id, id))

const kindsOf = async (id: string) => (await noticesOf(id)).map(n => n.kind).sort()

after(async () => {
  globalThis.fetch = realFetch
  for (const id of created) await db.delete(users).where(eq(users.id, id))
  await pool.end()
})

describe('the trial reminder — the promise the help articles make', () => {
  it('warns a free seller before the trial ends', async () => {
    sent = []
    const id = await seed({ trialEndsAt: ahead(TRIAL_REMINDER_DAYS - 1) })
    const result = await dispatchTierNudges()
    assert.ok(result.trialEnding >= 1)
    assert.deepEqual(await kindsOf(id), ['trial_ending'])

    const [notice] = await noticesOf(id)
    assert.equal(typeof notice.detail?.daysLeft, 'number')
    assert.ok(sent.some(m => m.includes(`chat-${id}`)), 'and tells them on Telegram')
  })

  it('does not warn while the trial is still comfortably running', async () => {
    const id = await seed({ trialEndsAt: ahead(TRIAL_REMINDER_DAYS + 5) })
    await dispatchTierNudges()
    assert.deepEqual(await kindsOf(id), [])
  })

  it('warns exactly once, however many times the sweep runs', async () => {
    const id = await seed({ trialEndsAt: ahead(1) })
    await dispatchTierNudges()
    const [first] = await noticesOf(id)
    await dispatchTierNudges()
    await dispatchTierNudges()
    const rows = await noticesOf(id)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].sentAt.getTime(), first.sentAt.getTime(), 'a daily sweep must not re-send daily')
  })

  it('tells them once the trial is over', async () => {
    const id = await seed({ trialEndsAt: ago(1) })
    await dispatchTierNudges()
    assert.deepEqual(await kindsOf(id), ['trial_ended'])
  })

  it('leaves an account that never had a trial alone', async () => {
    const id = await seed({ trialEndsAt: null })
    await dispatchTierNudges()
    assert.deepEqual(await kindsOf(id), [])
  })

  it('never nudges a paying account about its trial', async () => {
    const id = await seed({ plan: 'pro', trialEndsAt: ago(1) })
    await dispatchTierNudges()
    assert.deepEqual(await kindsOf(id), [])
  })
})

describe('outgrowing Free', () => {
  it('tells a free seller their turnover now lands on a paid tier', async () => {
    sent = []
    const id = await seed({ derivedTier: 'pro', turnoverSom: 30_000_000 })
    const result = await dispatchTierNudges()
    assert.ok(result.outgrewFree >= 1)
    assert.deepEqual(await kindsOf(id), ['outgrew_free'])

    const [notice] = await noticesOf(id)
    assert.equal(notice.detail?.turnoverSom, 30_000_000, 'the figure shown is recorded')
    assert.equal(notice.detail?.tier, 'pro')
    // The message must name the real turnover, not a rounded slogan.
    assert.ok(sent.some(m => m.includes('30 000 000')), 'the message names the measured turnover')
  })

  it('says nothing when the derived tier is still free', async () => {
    const id = await seed({ derivedTier: 'free', turnoverSom: 5_000_000 })
    await dispatchTierNudges()
    assert.deepEqual(await kindsOf(id), [])
  })

  it('says nothing when turnover has not been computed yet', async () => {
    const id = await seed({ derivedTier: null, turnoverSom: null })
    await dispatchTierNudges()
    assert.deepEqual(await kindsOf(id), [])
  })

  it('does not repeat inside the re-nudge window', async () => {
    const id = await seed({ derivedTier: 'pro', turnoverSom: 30_000_000 })
    await dispatchTierNudges()
    const [first] = await noticesOf(id)

    await dispatchTierNudges()
    const rows = await noticesOf(id)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].sentAt.getTime(), first.sentAt.getTime())
  })

  it('may repeat once the window has passed, with the fresh figure', async () => {
    const id = await seed({ derivedTier: 'pro', turnoverSom: 30_000_000 })
    await dispatchTierNudges()
    // Age the row past the window, and let the turnover move.
    await db.update(userNotices)
      .set({ sent_at: ago(RENUDGE_DAYS + 1) })
      .where(and(eq(userNotices.user_id, id), eq(userNotices.kind, 'outgrew_free')))
    await db.update(users).set({ derived_turnover_som: '60000000', derived_tier: 'pro_plus' }).where(eq(users.id, id))

    await dispatchTierNudges()
    const rows = await noticesOf(id)
    assert.equal(rows.length, 1, 'still one row per kind')
    assert.equal(rows[0].detail?.turnoverSom, 60_000_000, 'and it carries the current figure, not the old one')
    assert.equal(rows[0].detail?.tier, 'pro_plus')
  })

  it('never nudges a paying account about outgrowing free', async () => {
    const id = await seed({ plan: 'pro_plus', derivedTier: 'biznes', turnoverSom: 130_000_000 })
    await dispatchTierNudges()
    assert.deepEqual(await kindsOf(id), [])
  })

  it('records the nudge even for a seller with no Telegram', async () => {
    const id = await seed({ derivedTier: 'pro', turnoverSom: 30_000_000, telegram: false })
    await dispatchTierNudges()
    assert.deepEqual(await kindsOf(id), ['outgrew_free'],
      'delivery is best-effort; the in-app banner must still appear')
  })
})

describe('approaching Enterprise', () => {
  it('reaches out at the threshold, and tells the operators too', async () => {
    sent = []
    const id = await seed({ derivedTier: 'biznes', turnoverSom: ENTERPRISE_POPUP_THRESHOLD })
    const result = await dispatchTierNudges()
    assert.ok(result.enterpriseOutreach >= 1)
    assert.ok((await kindsOf(id)).includes('enterprise_outreach'))

    // Outreach means a person gets in touch: the seller hearing about it is only
    // half of it, and the half that does not scale is the operator knowing.
    assert.ok(sent.some(m => m.includes(`chat-${id}`)), 'the seller is told')
    assert.ok(sent.some(m => ADMIN_CHAT_IDS.some(a => m.includes(a))), 'the operators are told')
  })

  it('stays quiet just below the threshold', async () => {
    const id = await seed({ derivedTier: 'biznes', turnoverSom: ENTERPRISE_POPUP_THRESHOLD - 1 })
    await dispatchTierNudges()
    assert.ok(!(await kindsOf(id)).includes('enterprise_outreach'))
  })

  it('fires for a PAYING account — the threshold sits inside Biznes', async () => {
    const id = await seed({ plan: 'biznes', derivedTier: 'biznes', turnoverSom: 170_000_000 })
    const kinds = await kindsOf(id)
    await dispatchTierNudges()
    assert.ok((await kindsOf(id)).includes('enterprise_outreach'),
      'the seller this is written for is usually already paying')
    assert.ok(!kinds.includes('outgrew_free'), 'and is not nudged about outgrowing free')
  })

  it('does not repeat inside the re-nudge window', async () => {
    const id = await seed({ plan: 'biznes', derivedTier: 'biznes', turnoverSom: 170_000_000 })
    await dispatchTierNudges()
    const before = (await noticesOf(id)).find(n => n.kind === 'enterprise_outreach')!
    await dispatchTierNudges()
    const after = (await noticesOf(id)).find(n => n.kind === 'enterprise_outreach')!
    assert.equal(after.sentAt.getTime(), before.sentAt.getTime())
  })

  it('records the turnover and the threshold that triggered it', async () => {
    const id = await seed({ plan: 'biznes', derivedTier: 'biznes', turnoverSom: 175_000_000 })
    await dispatchTierNudges()
    const notice = (await noticesOf(id)).find(n => n.kind === 'enterprise_outreach')!
    assert.equal(notice.detail?.turnoverSom, 175_000_000)
    assert.equal(notice.detail?.threshold, ENTERPRISE_POPUP_THRESHOLD)
  })

  it('says nothing when turnover has not been computed', async () => {
    const id = await seed({ plan: 'biznes', derivedTier: null, turnoverSom: null })
    await dispatchTierNudges()
    assert.deepEqual(await kindsOf(id), [])
  })
})

describe('the banner the dashboard reads', () => {
  it('shows the newest undismissed nudge', async () => {
    const id = await seed({ trialEndsAt: ago(1), derivedTier: 'pro', turnoverSom: 30_000_000 })
    await dispatchTierNudges()
    const active = await getActiveNotice(id)
    assert.ok(active, 'something is shown')
    assert.equal((await noticesOf(id)).length, 2, 'both nudges were recorded')
  })

  it('stays gone once dismissed', async () => {
    const id = await seed({ trialEndsAt: ago(1) })
    await dispatchTierNudges()
    await dismissNotice(id, 'trial_ended')
    assert.equal(await getActiveNotice(id), null)

    // And a repeat sweep does not resurrect a once-only nudge.
    await dispatchTierNudges()
    assert.equal(await getActiveNotice(id), null)
  })

  it('comes back when a recurring condition genuinely recurs', async () => {
    const id = await seed({ derivedTier: 'pro', turnoverSom: 30_000_000 })
    await dispatchTierNudges()
    await dismissNotice(id, 'outgrew_free')
    assert.equal(await getActiveNotice(id), null)

    await db.update(userNotices)
      .set({ sent_at: ago(RENUDGE_DAYS + 1) })
      .where(and(eq(userNotices.user_id, id), eq(userNotices.kind, 'outgrew_free')))
    await dispatchTierNudges()
    assert.ok(await getActiveNotice(id), 'a re-sent nudge clears the old dismissal')
  })

  it('is silent for an account with nothing to say', async () => {
    const id = await seed({ plan: 'pro' })
    await dispatchTierNudges()
    assert.equal(await getActiveNotice(id), null)
  })
})
