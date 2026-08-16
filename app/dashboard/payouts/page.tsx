import { CreditCard } from 'lucide-react'
import { getPayoutEntries } from '@/lib/db/payouts'
import PayoutsView from '@/components/dashboard/PayoutsView'
import { getT } from '@/lib/server-i18n'

// Same preset vocabulary as the dashboard's DateRangePicker (?days=…).
function parseDays(v: string): number {
  if (v === '7') return 7
  if (v === '30') return 30
  if (v === '90') return 90
  if (v === '365') return 365
  if (v === 'month') return new Date().getDate() // days elapsed this month
  return 365
}
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function PayoutsPage({ searchParams }: Props) {
  const params = await searchParams
  const period = params?.days ?? '365'
  const from = params?.from
  const to = params?.to
  // Effective range: an explicit custom range wins; otherwise the preset window.
  const rangeFrom = from ?? daysAgo(parseDays(period))
  const rangeTo = to ?? new Date().toISOString().slice(0, 10)

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

      <PayoutsView entries={entries} period={period} from={from} to={to} />
    </div>
  )
}
