import { Suspense } from 'react'
import { CreditCard } from 'lucide-react'
import { getPayoutEntries } from '@/lib/db/payouts'
import PayoutsView from '@/components/dashboard/PayoutsView'
import { getT, getLang } from '@/lib/server-i18n'
import { startOfIsoWeek, localDateStr } from '@/lib/period-week'
import { currentUserAccess } from '@/lib/billing/entitlement'
import FeatureLock from '@/components/dashboard/FeatureLock'

// Same preset vocabulary as the dashboard's DateRangePicker (?days=…), plus
// `week` — the default here.
//
// `week` is the CURRENT ISO week (Monday→today), not a rolling 7 days. The
// difference is the whole point of the weekly view: a rolling window slides a
// little every day and never closes, so nothing ever becomes "last week". A
// calendar week ends on Sunday night; come Monday the page shows a fresh week
// and the finished one is reachable through the range picker. That is the
// history.
function parseDays(v: string): number {
  if (v === '7') return 7
  if (v === '30') return 30
  if (v === '90') return 90
  if (v === '365') return 365
  if (v === 'month') return new Date().getDate() // days elapsed this month
  return 365
}

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function PayoutsPage({ searchParams }: Props) {
  // Gate BEFORE the queries — see the note on the analytics page.
  const [lang, access] = await Promise.all([getLang(), currentUserAccess('finances')])
  if (!access.allowed) return <FeatureLock lang={lang} feature="finances" hadTrial={access.trialEnded} />

  const params = await searchParams
  const period = params?.days ?? 'week'
  const from = params?.from
  const to = params?.to
  // Effective range: an explicit custom range wins; otherwise the preset window.
  // localDateStr, never toISOString() — the latter converts to UTC, which in a
  // +05:00 shop turns "today" into "yesterday" for the last five hours of every
  // evening, silently dropping the newest orders out of the range.
  const now = new Date()
  const rangeFrom = from ?? (period === 'week'
    ? localDateStr(startOfIsoWeek(now))
    : localDateStr(new Date(now.getTime() - parseDays(period) * 86_400_000)))
  const rangeTo = to ?? localDateStr(now)

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

      {/* Suspense boundary required: PayoutsView renders DateRangePicker, a client
          component that calls useSearchParams() (mirrors the dashboard page). */}
      <Suspense>
        <PayoutsView entries={entries} period={period} from={from} to={to} />
      </Suspense>
    </div>
  )
}
