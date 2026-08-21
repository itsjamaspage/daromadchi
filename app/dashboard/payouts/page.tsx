import { Suspense } from 'react'
import { CreditCard } from 'lucide-react'
import { getPayoutEntries } from '@/lib/db/payouts'
import PayoutsView from '@/components/dashboard/PayoutsView'
import { getT, getLang } from '@/lib/server-i18n'
import { startOfIsoWeek, localDateStr } from '@/lib/period-week'
import { currentUserAccess } from '@/lib/billing/entitlement'
import FeatureLock from '@/components/dashboard/FeatureLock'

// This page DEFAULTS to the current week. There are no preset chips: the
// default is fixed in code rather than chosen, and ?days= is ignored so a stale
// link carrying an old preset cannot put the page on a range it no longer
// offers. An explicit ?from=&?to= pair — the only thing the date inputs
// produce — is honoured, so a seller can still read any other week.
//
// "Week" is the calendar week, Monday→today — not a rolling seven days. A
// rolling window slides a little every day and never closes; a calendar week
// ends Sunday night and a fresh one starts Monday, which is what makes this
// page mean "this week's earnings" without anyone setting anything.

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function PayoutsPage({ searchParams }: Props) {
  // Gate BEFORE the queries — see the note on the analytics page.
  const [lang, access] = await Promise.all([getLang(), currentUserAccess('finances')])
  if (!access.allowed) return <FeatureLock lang={lang} feature="finances" hadTrial={access.trialEnded} />

  // localDateStr, never toISOString() — the latter converts to UTC, which in a
  // +05:00 shop turns "today" into "yesterday" for the last five hours of every
  // evening, silently dropping the newest orders out of the range.
  const params = await searchParams
  // Both bounds or neither — a half-set range would silently pair one custom
  // date with a default, which is not a range anyone asked for.
  const custom = params?.from && params?.to ? { from: params.from, to: params.to } : null
  const now = new Date()
  const rangeFrom = custom?.from ?? localDateStr(startOfIsoWeek(now))
  const rangeTo = custom?.to ?? localDateStr(now)

  const [t, entries] = await Promise.all([
    getT(),
    getPayoutEntries({ from: rangeFrom, to: rangeTo }),
  ])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-card2)] border border-[var(--border)] flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-[var(--c1)]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.payoutsTitle}</h1>
          </div>
          <p className="text-[var(--text-muted)] text-sm">{d.payoutsSubtitle}</p>
        </div>
      </div>

      <Suspense>
        <PayoutsView entries={entries} from={custom?.from} to={custom?.to} />
      </Suspense>
    </div>
  )
}
