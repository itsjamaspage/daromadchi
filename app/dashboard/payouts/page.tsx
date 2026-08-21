import { Suspense } from 'react'
import { CreditCard } from 'lucide-react'
import { getPayoutEntries } from '@/lib/db/payouts'
import PayoutsView from '@/components/dashboard/PayoutsView'
import { getT, getLang } from '@/lib/server-i18n'
import { startOfIsoWeek, previousIsoWeekBounds, localDateStr } from '@/lib/period-week'
import { currentUserAccess } from '@/lib/billing/entitlement'
import FeatureLock from '@/components/dashboard/FeatureLock'

// This page offers exactly two presets: `week` and `lastweek`. Both are
// CALENDAR weeks (Monday→Sunday), not rolling windows — a rolling window slides
// a little every day and never closes, so no week is ever finished and nothing
// ever becomes "last week".
//
//   week      Monday of the current week → today (the week so far)
//   lastweek  Monday → Sunday of the week before (a closed range)
//
// `lastweek` is the only preset here with a fixed END date. The others ran to
// today, so the range code below cannot assume `to = today` — an off-by-one
// there would silently fold last week's Sunday into this week.
function presetRange(preset: string, now: Date): { from: string; to: string } {
  if (preset === 'lastweek') {
    const b = previousIsoWeekBounds(now)
    return { from: localDateStr(b.start), to: localDateStr(b.end) }
  }
  // 'week' and anything unrecognised: the current week so far.
  return { from: localDateStr(startOfIsoWeek(now)), to: localDateStr(now) }
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
  // Effective range: an explicit custom range from the date inputs wins;
  // otherwise the preset window.
  //
  // localDateStr, never toISOString() — the latter converts to UTC, which in a
  // +05:00 shop turns "today" into "yesterday" for the last five hours of every
  // evening, silently dropping the newest orders out of the range.
  const preset = presetRange(period, new Date())
  const rangeFrom = from ?? preset.from
  const rangeTo = to ?? preset.to

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
