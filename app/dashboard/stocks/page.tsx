import { Boxes, Settings } from 'lucide-react'
import Link from 'next/link'
import { getStockGroups } from '@/lib/db/stock-groups'
import StocksTable from '@/components/dashboard/StocksTable'
import ProductGroupSuggestions from '@/components/dashboard/ProductGroupSuggestions'
import HelpTooltip from '@/components/dashboard/HelpTooltip'
import { getT, getLang } from '@/lib/server-i18n'
import { currentUserAccess, everyActiveShopIsReadOnly } from '@/lib/billing/entitlement'
import { getCurrentUserId } from '@/lib/db/shop-context'
import FeatureLock from '@/components/dashboard/FeatureLock'
import { lockT } from '@/lib/lockT'

export const dynamic = 'force-dynamic'

export default async function StocksPage() {
  // Gated, not frozen — and only when there is genuinely nothing left to show.
  //
  // A seller who still has one stock_sync shop keeps the page: write-back is off
  // for them under lib/marketplace/stock-sync.ts, but the live figures they can
  // see are real. A seller whose every active shop is read_only never had
  // write-back, so past the trial this page holds nothing they are entitled to.
  //
  // What it must never do is serve a stale snapshot dressed as live: a wrong
  // number here has the seller restock against it.
  const [lang, access] = await Promise.all([getLang(), currentUserAccess('stock_sync')])
  if (!access.allowed) {
    const userId = await getCurrentUserId()
    if (!userId || await everyActiveShopIsReadOnly(userId)) {
      return <FeatureLock lang={lang} feature="stock_sync" hadTrial={access.trialEnded}
        note={lockT.stockNote[lang]} />
    }
  }

  const [t, groups] = await Promise.all([getT(), getStockGroups()])
  const d = t.dashboard.stocksPage

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold mb-0.5" style={{ color: 'var(--text-base)' }}>{d.title}</h1>
            <HelpTooltip section="stocks" />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{d.subtitle}</p>
        </div>
      </div>

      {/* Read-only suggestion panel; self-hides when there are 0 pending. */}
      <ProductGroupSuggestions />

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
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors btn-primary">
            <Settings className="w-4 h-4" /> {t.dashboard.nav.settings}
          </Link>
        </div>
      ) : (
        <StocksTable groups={groups} />
      )}
    </div>
  )
}
