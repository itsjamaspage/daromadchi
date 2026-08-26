/**
 * Admin analytics, against a real Postgres.
 *
 * Proves every metric on /dashboard/admin computes from live rows and MOVES
 * correctly as customers come in — and that the founder (ADMIN_EMAIL) and the
 * synthetic '[atmos:direct test]' row never inflate anything. Seeds a realistic
 * spread (active / annual / churned / past-due / trial + founder + test row),
 * runs getAdminAnalytics, asserts the numbers, then deletes everything it made.
 *
 * Run: DATABASE_URL=postgres://…/scratch ADMIN_EMAIL=founder@drm.test \
 *        node --import tsx --test lib/db/admin-analytics.integration.test.ts
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { inArray } from 'drizzle-orm'
import { db, pool, users, subscriptions, payments } from '@/lib/db'
import { getAdminAnalytics, tashkentMonthStart } from './admin-analytics'
import { PLAN_PRICES_TIYIN, planAnnualTotalTiyin } from '@/lib/billing/plans'

const DAY = 24 * 60 * 60 * 1000
const FOUNDER = 'founder@drm.test'

const userIds: string[] = []
const now = new Date()
const monthStart = tashkentMonthStart(now)
const lastMonth = new Date(monthStart.getTime() - 5 * DAY)   // in the previous month
const twoMonthsAgo = new Date(monthStart.getTime() - 40 * DAY)
const future = new Date(now.getTime() + 20 * DAY)

const proMonthly = PLAN_PRICES_TIYIN.pro.monthly
const proPlusAnnualTotal = planAnnualTotalTiyin('pro_plus')
const proPlusMonthly = Math.round(proPlusAnnualTotal / 12)

async function seedUser(email: string, fields: Partial<typeof users.$inferInsert> = {}): Promise<string> {
  const id = randomUUID()
  await db.insert(users).values({ id, email, ...fields })
  userIds.push(id)
  return id
}

describe('admin analytics — live metrics', () => {
  before(async () => {
    process.env.ADMIN_EMAIL = FOUNDER

    // Founder — must be excluded from EVERY figure.
    const founderId = await seedUser(FOUNDER, { plan: 'pro', plan_expires_at: future, created_at: now })
    await db.insert(subscriptions).values({ user_id: founderId, plan: 'pro', interval: 'monthly', status: 'active', current_period_end: future, agreed_amount_tiyin: proMonthly, created_at: now })
    await db.insert(payments).values({ user_id: founderId, payer_email: FOUNDER, provider: 'atmos', plan: 'pro', amount: '250000', amount_tiyin: 25_000_000, status: 'paid', atmos_status: 'success', confirmed_at: now, account: randomUUID() })

    // Synthetic ATMOS test row (no user) — must be excluded.
    await db.insert(payments).values({ payer_email: '[atmos:direct test]', provider: 'atmos', plan: 'pro', amount: '50000', amount_tiyin: 5_000_000, status: 'paid', atmos_status: 'success', confirmed_at: now, account: randomUUID() })

    // A — Pro monthly, active, started THIS month; paid this month.
    const a = await seedUser('a@real.test', { plan: 'pro', plan_expires_at: future, created_at: now })
    await db.insert(subscriptions).values({ user_id: a, plan: 'pro', interval: 'monthly', status: 'active', current_period_end: future, agreed_amount_tiyin: proMonthly, created_at: now })
    await db.insert(payments).values({ user_id: a, payer_email: 'a@real.test', provider: 'atmos', plan: 'pro', amount: String(proMonthly / 100), amount_tiyin: proMonthly, status: 'paid', atmos_status: 'success', confirmed_at: now, account: randomUUID() })

    // B — Pro+ ANNUAL, active, started LAST month; paid last month.
    const b = await seedUser('b@real.test', { plan: 'pro_plus', plan_expires_at: future, created_at: lastMonth })
    await db.insert(subscriptions).values({ user_id: b, plan: 'pro_plus', interval: 'annual', status: 'active', current_period_end: future, agreed_amount_tiyin: proPlusAnnualTotal, created_at: lastMonth })
    await db.insert(payments).values({ user_id: b, payer_email: 'b@real.test', provider: 'atmos', plan: 'pro_plus', amount: String(proPlusAnnualTotal / 100), amount_tiyin: proPlusAnnualTotal, status: 'paid', atmos_status: 'success', confirmed_at: lastMonth, account: randomUUID() })

    // C — Biznes, CHURNED this month (cancelled_at = now).
    const c = await seedUser('c@real.test', { plan: 'free', created_at: twoMonthsAgo })
    await db.insert(subscriptions).values({ user_id: c, plan: 'biznes', interval: 'monthly', status: 'cancelled', current_period_end: new Date(now.getTime() - DAY), cancelled_at: now, updated_at: now, agreed_amount_tiyin: PLAN_PRICES_TIYIN.biznes.monthly, created_at: twoMonthsAgo })

    // D — Pro monthly, PAST DUE inside its paid period (started last month).
    const d = await seedUser('d@real.test', { plan: 'pro', plan_expires_at: future, created_at: lastMonth })
    await db.insert(subscriptions).values({ user_id: d, plan: 'pro', interval: 'monthly', status: 'past_due', current_period_end: future, agreed_amount_tiyin: proMonthly, created_at: lastMonth })

    // E — churned in a PAST month (cancelled_at = last month), but its row was
    // TOUCHED this month (updated_at = now). Regression guard: churn must stay
    // dated to cancelled_at, never re-dated to the update month.
    const threeMonthsAgo = new Date(monthStart.getTime() - 70 * DAY)
    const e = await seedUser('e@real.test', { plan: 'free', created_at: threeMonthsAgo })
    await db.insert(subscriptions).values({ user_id: e, plan: 'pro', interval: 'monthly', status: 'cancelled', current_period_end: lastMonth, cancelled_at: lastMonth, updated_at: now, agreed_amount_tiyin: proMonthly, created_at: threeMonthsAgo })

    // Trial — free plan, trial not over. NOT paying.
    await seedUser('trial@real.test', { plan: 'free', trial_ends_at: future, created_at: now })
  })

  after(async () => {
    if (userIds.length) {
      await db.delete(payments).where(inArray(payments.user_id, userIds))
      await db.delete(subscriptions).where(inArray(subscriptions.user_id, userIds))
      await db.delete(users).where(inArray(users.id, userIds))
    }
    // The synthetic no-user test payment.
    await db.delete(payments).where(inArray(payments.payer_email, ['[atmos:direct test]']))
    await pool.end()
  })

  it('computes every metric from real rows and excludes founder + test data', async () => {
    const r = await getAdminAnalytics(now)
    const m = r.metrics

    console.log('\n  ── computed metrics ──')
    const log = (k: string, v: unknown) => console.log(`  ${k.padEnd(22)} ${v}`)
    log('totalUsers', m.totalUsers)
    log('trialUsers', m.trialUsers)
    log('paidPlanUsers', m.paidPlanUsers)
    log('activeCount', m.activeCount)
    log('MRR (tiyin)', m.mrrTiyin)
    log('ARR (tiyin)', m.arrTiyin)
    log('byPlan', JSON.stringify(m.byPlan))
    log('byInterval', JSON.stringify(m.byInterval))
    log('newThisMonth (subs)', m.newThisMonth)
    log('churnedThisMonth', m.churnedThisMonth)
    log('pastDueCount', m.pastDueCount)
    log('totalRevenue (tiyin)', m.totalRevenueTiyin)
    log('monthRevenue (tiyin)', m.monthRevenueTiyin)
    log('activeSubscribers', r.activeSubscribers.length)
    log('recentPayments', r.recentPayments.length)
    log('churned rows', r.churned.length)

    // ── user base (founder excluded → 6 non-founder users) ──
    assert.equal(m.totalUsers, 6, 'totalUsers excludes founder')
    assert.equal(m.trialUsers, 1)
    assert.equal(m.paidPlanUsers, 3, 'A, B, D on a live paid plan (C, E free/expired)')

    // ── subscriptions ──
    assert.equal(m.activeCount, 2, 'A + B active; D past_due, C churned, founder excluded')
    assert.equal(m.byPlan.pro.count, 1)
    assert.equal(m.byPlan.pro_plus.count, 1)
    assert.equal(m.byPlan.biznes.count, 0)
    assert.equal(m.byInterval.monthly.count, 1)
    assert.equal(m.byInterval.annual.count, 1)
    assert.equal(m.newThisMonth, 1, 'only A started this month')
    assert.equal(m.churnedThisMonth, 1, 'only C churned THIS month — E cancelled last month is not re-counted despite its updated_at=now')
    assert.equal(m.pastDueCount, 1, 'D past_due within period')

    // ── money: MRR = pro monthly + pro+ annual/12; founder & test excluded ──
    assert.equal(m.mrrTiyin, proMonthly + proPlusMonthly, 'MRR reflects real plan prices')
    assert.equal(m.arrTiyin, m.mrrTiyin * 12)
    assert.equal(m.totalRevenueTiyin, proMonthly + proPlusAnnualTotal, 'excludes founder 250k + test 50k')
    assert.equal(m.monthRevenueTiyin, proMonthly, 'only A paid this month')

    // ── funnel ──
    assert.equal(m.totalUsers, 6)          // registered
    assert.equal(m.paidPlanUsers, 3)       // on a paid plan
    assert.equal(m.activeCount, 2)         // actively paying

    // ── exclusion is airtight in the lists too ──
    const emails = r.recentPayments.map(p => p.email)
    assert.ok(!emails.includes('[atmos:direct test]'), 'test row hidden from payments')
    assert.ok(!emails.includes(FOUNDER), 'founder hidden from payments')
    assert.equal(r.recentPayments.length, 2, 'only A + B payments remain')
    assert.equal(r.activeSubscribers.length, 2)
    assert.ok(r.churned.some(c => c.plan === 'biznes'), 'C shows in churned')
    assert.equal(r.churned.length, 2, 'C (this month) + E (last month)')

    // ── churn dating: keyed off cancelled_at, not updated_at (regression) ──
    // Asia/Tashkent, because that is the zone the production query keys months
    // in: `to_char(… AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM')`. Comparing a
    // UTC-derived key against a Tashkent-derived one agrees for most of the
    // month and disagrees on the 1st before 05:00 local — a test that would have
    // failed a few hours a month for a reason unrelated to churn dating.
    const ymTashkent = (d: Date) =>
      d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' }).slice(0, 7)
    const lastMonthYM = ymTashkent(new Date(lastMonth))
    const thisMonthYM = ymTashkent(now)
    const eRow = r.churned.find(x => x.email === 'e@real.test')
    assert.ok(eRow, 'E appears in churned')
    assert.equal(eRow!.lapsedAt?.slice(0, 7), lastMonthYM, 'E lapse dated to cancelled_at (last) month, NOT its update month')
    assert.notEqual(eRow!.lapsedAt?.slice(0, 7), thisMonthYM, 'E must not be re-dated to this month')

    // ── the derived series reflects the movement ──
    const thisMonthPoint = r.mrrSeriesMonthly[r.mrrSeriesMonthly.length - 1]
    const lastMonthPoint = r.mrrSeriesMonthly[r.mrrSeriesMonthly.length - 2]
    assert.ok(thisMonthPoint.newMrrTiyin >= proMonthly, 'this month added ≥ A to new MRR')
    assert.equal(thisMonthPoint.churnedMrrTiyin, PLAN_PRICES_TIYIN.biznes.monthly, 'this month churn is exactly C — E is NOT here')
    assert.ok(lastMonthPoint.churnedMrrTiyin >= proMonthly, 'E churn lands in LAST month — KPI and chart now agree')

    console.log('  ✓ all assertions passed\n')
  })
})
