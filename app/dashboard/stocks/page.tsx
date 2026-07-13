import { Boxes, Settings } from 'lucide-react'
import Link from 'next/link'
import { getStockGroups } from '@/lib/db/stock-groups'
import StocksTable from '@/components/dashboard/StocksTable'
import { getT } from '@/lib/server-i18n'

export const dynamic = 'force-dynamic'

export default async function StocksPage() {
  const [t, groups] = await Promise.all([getT(), getStockGroups()])
  const d = t.dashboard.stocksPage

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-0.5" style={{ color: 'var(--text-base)' }}>{d.title}</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{d.subtitle}</p>
      </div>

      {groups.length === 0 ? (
        <div className="border border-dashed rounded-2xl p-10 text-center"
          style={{ background: 'var(--bg-card2)', borderColor: 'rgba(131, 192, 249, 0.3)' }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(131, 192, 249, 0.1)', borderColor: 'rgba(131, 192, 249, 0.2)', color: 'var(--c1)' }}>
            <Boxes className="w-7 h-7" />
          </div>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
            {d.noData}
          </p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            style={{ background: 'var(--c1)', color: 'white' }}>
            <Settings className="w-4 h-4" /> {t.dashboard.nav.settings}
          </Link>
        </div>
      ) : (
        <StocksTable groups={groups} />
      )}
    </div>
  )
}
