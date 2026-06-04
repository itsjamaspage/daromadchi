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
  const tab    = params.tab === 'yandex' ? 'yandex' : params.tab === 'wildberries' ? 'wildberries' : 'uzum'
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
          <h1 className="text-2xl font-bold text-[var(--text-base)] flex items-center gap-2">
            <Globe2 className="w-6 h-6 text-cyan-400" />
            {d.marketTitle}
          </h1>
          <HelpTooltip section="marketResearch" className="ml-1" />
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-400">
            {d.publicData}
          </span>
        </div>
        <p className="text-[var(--text-muted)] text-sm">
          {d.marketSubtitle}
        </p>
      </div>

      {/* Marketplace tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
        {([
          { id: 'uzum',        label: 'Uzum Market',   letter: 'U', accent: 'var(--c1)' },
          { id: 'yandex',      label: 'Yandex Market', letter: 'Y', accent: '#f59e0b'   },
          { id: 'wildberries', label: 'Wildberries',   letter: 'W', accent: '#cb11ab'   },
        ] as { id: string; label: string; letter: string; accent: string }[]).map(({ id, label, letter, accent }) => {
          const active = tab === id
          return (
            <Link
              key={id}
              href={`/dashboard/market?tab=${id}`}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border"
              style={active ? {
                background: `color-mix(in srgb, ${accent} 16%, transparent)`,
                color: accent,
                borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`,
              } : {
                color: 'var(--text-muted)',
                borderColor: 'transparent',
              }}
            >
              <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold"
                style={{ background: `color-mix(in srgb, ${accent} 20%, transparent)`, color: accent }}>
                {letter}
              </span>
              {label}
            </Link>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'uzum' && (
        <>
          <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-xs text-[var(--text-dim)]"
            style={{ background: 'color-mix(in srgb, var(--c1) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--c1) 22%, transparent)' }}>
            <Globe2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--c1)' }} />
            <span>
              {d.uzumApiNote}
              {userUzumCategories.length > 0
                ? d.uzumCategoriesHighlighted
                : d.connectToHighlight}
              {userUzumCategories.length === 0 && (
                <Link href="/dashboard/settings" className="ml-1 underline" style={{ color: 'var(--c1)' }}>{d.connectLink} →</Link>
              )}
            </span>
          </div>
          <MarketClient
            marketplace="uzum"
            initialCategories={uzumCategories}
            userCategories={userUzumCategories}
          />
        </>
      )}

      {tab === 'yandex' && (
        yandexConnected ? (
          <>
            <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-xs text-[var(--text-dim)]"
              style={{ background: 'rgba(245, 158, 11, 0.07)', border: '1px solid rgba(245, 158, 11, 0.22)' }}>
              <Globe2 className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
              <span>{d.yandexApiNote}</span>
            </div>
            <MarketClient marketplace="yandex" initialCategories={[]} userCategories={[]} />
          </>
        ) : (
          <div className="bg-[var(--bg-card2)] border border-dashed border-amber-500/30 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Globe2 className="w-7 h-7 text-amber-500" />
            </div>
            <h2 className="text-[var(--text-base)] font-bold text-lg mb-2">{d.yandexNotConnected}</h2>
            <p className="text-[var(--text-muted)] text-sm mb-6 max-w-sm mx-auto">{d.yandexNotConnectedDesc}</p>
            <Link href="/dashboard/settings"
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              <Settings className="w-4 h-4" /> {d.connectYandex}
            </Link>
          </div>
        )
      )}

      {tab === 'wildberries' && (
        <>
          <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-xs text-[var(--text-dim)]"
            style={{ background: 'rgba(203, 17, 171, 0.07)', border: '1px solid rgba(203, 17, 171, 0.22)' }}>
            <Globe2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#cb11ab' }} />
            <span>{d.wbApiNote}</span>
          </div>
          <MarketClient marketplace="wildberries" initialCategories={[]} userCategories={[]} />
        </>
      )}
    </div>
  )
}
