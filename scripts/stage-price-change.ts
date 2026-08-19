/**
 * Stage a price change for one subscription, with notice.
 *
 * There is no UI for this on purpose: raising a live subscriber's price is a
 * deliberate operator act, and every guard rail lives in
 * lib/billing/price-notice.ts, which this calls rather than reimplements.
 *
 * Nothing is charged by running this. It stages the amount and the date; the
 * daily job tells the seller; the renewal charges the new amount only once the
 * notice is at least PRICE_NOTICE_DAYS old and the date has arrived.
 *
 *   npx tsx scripts/stage-price-change.ts --subscription <uuid> --som 250000 --on 2026-11-01
 *   npx tsx scripts/stage-price-change.ts --subscription <uuid> --som 250000 --on 2026-11-01 --apply
 *
 * Without --apply it prints what it would do and changes nothing.
 */
import { eq } from 'drizzle-orm'
import { db, pool, subscriptions } from '../lib/db'
import { stagePriceChange, PRICE_NOTICE_DAYS } from '../lib/billing/price-notice'
import { formatSomFromTiyin } from '../lib/billing/plans'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

async function main() {
  const subscriptionId = arg('subscription')
  const som = Number(arg('som'))
  const on = arg('on')
  const apply = process.argv.includes('--apply')

  if (!subscriptionId || !Number.isFinite(som) || som <= 0 || !on) {
    console.error('usage: --subscription <uuid> --som <amount> --on <YYYY-MM-DD> [--apply]')
    process.exit(1)
  }

  const effectiveDate = new Date(`${on}T00:00:00.000Z`)
  if (Number.isNaN(effectiveDate.getTime())) {
    console.error(`bad date: ${on}`)
    process.exit(1)
  }
  const newAmountTiyin = Math.round(som * 100)

  const [sub] = await db.select({
    id: subscriptions.id, userId: subscriptions.user_id, plan: subscriptions.plan,
    status: subscriptions.status, agreed: subscriptions.agreed_amount_tiyin,
  }).from(subscriptions).where(eq(subscriptions.id, subscriptionId))

  if (!sub) {
    console.error(`no subscription ${subscriptionId}`)
    process.exit(1)
  }

  console.log(`subscription ${sub.id}`)
  console.log(`  user      ${sub.userId}`)
  console.log(`  plan      ${sub.plan} (${sub.status})`)
  console.log(`  agreed    ${sub.agreed == null ? '—' : formatSomFromTiyin(sub.agreed) + " so'm"}`)
  console.log(`  new       ${formatSomFromTiyin(newAmountTiyin)} so'm`)
  console.log(`  effective ${effectiveDate.toISOString().slice(0, 10)}`)
  console.log(`  notice    at least ${PRICE_NOTICE_DAYS} days before the charge`)

  if (!apply) {
    console.log('\ndry run — pass --apply to stage it')
    return
  }

  const result = await stagePriceChange({ subscriptionId, newAmountTiyin, effectiveDate })
  if (!result.ok) {
    console.error(`\nrefused: ${result.reason}`)
    process.exit(1)
  }
  console.log('\nstaged. The daily job will notify the seller; nothing is charged until they have been told.')
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => pool.end())
