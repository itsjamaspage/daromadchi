import { CreditCard } from 'lucide-react'
import { getPayoutEntries } from '@/lib/db/payouts'
import PayoutsView from '@/components/dashboard/PayoutsView'
import { getT, getLang } from '@/lib/server-i18n'
import { startOfIsoWeek, localDateStr } from '@/lib/period-week'
import { currentUserAccess } from '@/lib/billing/entitlement'
import FeatureLock from '@/components/dashboard/FeatureLock'

// This page shows the CURRENT WEEK and nothing else. The range is fixed in
// code: no presets, no custom dates, no ?days= / ?from= / ?to= override. A URL
// carrying those params is ignored rather than honoured, so a stale link or an
// old bookmark cannot put the page on a range it no longer offers.
//
// "Week" is the calendar week, Monday→today — not a rolling seven days. A
// rolling window slides a little every day and never closes; a calendar week
// ends Sunday night and a fresh one starts Monday, which is what makes this
// page mean "this week's earnings" without anyone setting anything.

export default async function PayoutsPage() {
  // Gate BEFORE the queries — see the note on the analytics page.
  const [lang, access] = await Promise.all([getLang(), currentUserAccess('finances')])
  if (!access.allowed) return <FeatureLock lang={lang} feature="finances" hadTrial={access.trialEnded} />

  // localDateStr, never toISOString() — the latter converts to UTC, which in a
  // +05:00 shop turns "today" into "yesterday" for the last five hours of every
  // evening, silently dropping the newest orders out of the range.
  const now = new Date()
  const rangeFrom = localDateStr(startOfIsoWeek(now))
  const rangeTo = localDateStr(now)

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

      <PayoutsView entries={entries} />
    </div>
  )
}
