import { Globe2, Settings } from 'lucide-react'
import HelpTooltip from '@/components/dashboard/HelpTooltip'
import Link from 'next/link'
import { getRootCategories } from '@/lib/uzum/public'
import { getProducts } from '@/lib/db/products'
import { createClient } from '@/lib/supabase/server'
import MarketClient from './MarketClient'
import { getT } from '@/lib/server-i18n'

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function MarketPage({ searchParams }: Props) {
  const params = await searchParams
  const tab    = params.tab === 'yandex' ? 'yandex' : 'uzum'
  const t = await getT()
  const d = t.dashboard

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check whether Yandex is connected
  let yandexConnected = false
  if (user) {
    const { data } = await supabase
      .from('shops')
      .select('api_key_encrypted')
      .eq('user_id', user.id)
      .eq('marketplace', 'yandex_market')
      .single()
    yandexConnected = !!data?.api_key_encrypted
  }

  // Uzum tab: public categories + user's synced product categories
  const [uzumCategories, myProducts] = tab === 'uzum'
    ? await Promise.all([getRootCategories(), getProducts('uzum')])
    : [[], []]

  const userUzumCategories = [...new Set(myProducts.map(p => p.category).filter(Boolean))] as string[]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-0.5">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe2 className="w-6 h-6 text-cyan-400" />
            {d.marketTitle}
          </h1>
          <HelpTooltip section="marketResearch" className="ml-1" />
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-400">
            {d.publicData}
          </span>
        </div>
        <p className="text-slate-400 text-sm">
          {d.marketSubtitle}
        </p>
      </div>

      {/* Marketplace tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
        <Link
          href="/dashboard/market?tab=uzum"
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            tab === 'uzum'
              ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <span className="w-4 h-4 rounded bg-violet-500/20 flex items-center justify-center text-[9px] font-bold text-violet-400">U</span>
          Uzum Market
        </Link>
        <Link
          href="/dashboard/market?tab=yandex"
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            tab === 'yandex'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <span className="w-4 h-4 rounded bg-amber-500/20 flex items-center justify-center text-[9px] font-bold text-amber-400">Y</span>
          Yandex Market
        </Link>
      </div>

      {/* Tab content */}
      {tab === 'uzum' ? (
        <>
          <div className="flex items-start gap-3 bg-violet-500/[0.06] border border-violet-500/20 rounded-xl px-4 py-3 text-xs text-violet-300/80">
            <Globe2 className="w-4 h-4 mt-0.5 shrink-0 text-violet-400" />
            <span>
              {d.uzumApiNote}
              {userUzumCategories.length > 0
                ? d.uzumCategoriesHighlighted
                : d.connectToHighlight}
              {userUzumCategories.length === 0 && (
                <Link href="/dashboard/settings" className="ml-1 underline text-violet-400">{d.connectLink} →</Link>
              )}
            </span>
          </div>
          <MarketClient
            marketplace="uzum"
            initialCategories={uzumCategories}
            userCategories={userUzumCategories}
          />
        </>
      ) : (
        <>
          {yandexConnected ? (
            <>
              <div className="flex items-start gap-3 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-300/80">
                <Globe2 className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                <span>
                  {d.yandexApiNote}
                </span>
              </div>
              <MarketClient
                marketplace="yandex"
                initialCategories={[]}
                userCategories={[]}
              />
            </>
          ) : (
            <div className="bg-[var(--bg-card2)] border border-dashed border-amber-500/30 rounded-2xl p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <Globe2 className="w-7 h-7 text-amber-400" />
              </div>
              <h2 className="text-white font-bold text-lg mb-2">{d.yandexNotConnected}</h2>
              <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
                {d.yandexNotConnectedDesc}
              </p>
              <Link
                href="/dashboard/settings"
                className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                <Settings className="w-4 h-4" /> {d.connectYandex}
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
