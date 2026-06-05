import { getT } from '@/lib/server-i18n'
import { Search } from 'lucide-react'
import { getSearchPhrases } from '@/lib/db/search-phrases'
import KeywordsView from '@/components/dashboard/KeywordsView'

<<<<<<< HEAD
export default async function KeywordsPage() {
  const [t, phrases] = await Promise.all([getT(), getSearchPhrases()])
  const d = t.dashboard
=======
import { useState, useMemo } from 'react'
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import HelpTooltip from '@/components/dashboard/HelpTooltip'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

// ── Mock data ──────────────────────────────────────────────────────────────────

type KeywordRow = {
  id: number
  productName: string
  keywords: string[]
  impressions: number
  clicks: number
  ctr: number       // %
  position: number  // avg position
  trend: 'up' | 'down' | 'stable'
}

const mockKeywords: KeywordRow[] = [
  {
    id: 1,
    productName: "Erkaklar ko'ylagi oq",
    keywords: ["ko'ylak erkaklar", 'oq ko\'ylak', 'erkak kiyim', 'ofis ko\'ylak', 'slim fit'],
    impressions: 48_200,
    clicks: 2_150,
    ctr: 4.46,
    position: 3.2,
    trend: 'up',
  },
  {
    id: 2,
    productName: 'Futbolka oq erkaklar',
    keywords: ['futbolka oq', 'oq futbolka', 'erkak futbolka', 'paxta futbolka'],
    impressions: 62_400,
    clicks: 1_870,
    ctr: 3.0,
    position: 5.8,
    trend: 'up',
  },
  {
    id: 3,
    productName: 'Ayollar ko\'ylagi yozgi',
    keywords: ['ayollar ko\'ylagi', 'yozgi ko\'ylak', 'platye ayol', 'ko\'ylak yengil', 'floral platye'],
    impressions: 91_600,
    clicks: 3_280,
    ctr: 3.58,
    position: 4.1,
    trend: 'stable',
  },
  {
    id: 4,
    productName: 'Jinsi shim erkak',
    keywords: ['jinsi shim', 'erkak jins', 'slim jins', 'ko\'k shim'],
    impressions: 38_900,
    clicks: 890,
    ctr: 2.29,
    position: 8.4,
    trend: 'down',
  },
  {
    id: 5,
    productName: 'Sport kostyum ayol',
    keywords: ['sport kostyum', 'trening ayol', 'sport kiyim ayol', 'yoga kiyim', 'sport to\'plam'],
    impressions: 29_100,
    clicks: 1_240,
    ctr: 4.26,
    position: 2.9,
    trend: 'up',
  },
  {
    id: 6,
    productName: 'Yozgi shim kalta',
    keywords: ['kalta shim', 'shim yozgi', 'beach shim', 'qisqa shim'],
    impressions: 18_500,
    clicks: 310,
    ctr: 1.68,
    position: 12.3,
    trend: 'down',
  },
  {
    id: 7,
    productName: 'Bola kiyim to\'plam',
    keywords: ['bola kiyim', 'bolalar kiyim', 'bola kostyum', 'kichik bola kiyim'],
    impressions: 55_700,
    clicks: 2_890,
    ctr: 5.19,
    position: 1.8,
    trend: 'up',
  },
  {
    id: 8,
    productName: 'Qishki palto ayol',
    keywords: ['palto ayol', 'qishki palto', 'issiq palto', 'uzun palto'],
    impressions: 11_300,
    clicks: 180,
    ctr: 1.59,
    position: 14.7,
    trend: 'down',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up')     return <TrendingUp   className="w-3.5 h-3.5 text-emerald-400" />
  if (trend === 'down')   return <TrendingDown className="w-3.5 h-3.5 text-red-400" />
  return <Minus className="w-3.5 h-3.5 text-[var(--text-muted)]" />
}

// ── Page ───────────────────────────────────────────────────────────────────────

type Tab = 'all' | 'growing' | 'declining'

export default function KeywordsPage() {
  const { lang } = useLang()
  const t = dashT[lang].keywords
  const [search, setSearch]     = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('all')

  const filtered = useMemo(() => {
    let rows = mockKeywords

    if (activeTab === 'growing')   rows = rows.filter(r => r.trend === 'up')
    if (activeTab === 'declining') rows = rows.filter(r => r.trend === 'down')

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        r.productName.toLowerCase().includes(q) ||
        r.keywords.some(k => k.toLowerCase().includes(q))
      )
    }

    return rows
  }, [search, activeTab])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all',       label: t.tabAll      },
    { key: 'growing',   label: t.tabGrowing  },
    { key: 'declining', label: t.tabDeclining },
  ]
>>>>>>> origin/claude/friendly-rubin-IkT6S

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
<<<<<<< HEAD
          <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.keywordsTitle}</h1>
        </div>
        <p className="text-[var(--text-muted)] text-sm">{d.keywordsSubtitle}</p>
      </div>

      {phrases.length === 0 ? (
        <div className="border border-dashed rounded-2xl p-10 text-center" style={{ background: 'var(--bg-card2)', borderColor: 'rgba(124, 58, 237, 0.3)' }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(124, 58, 237, 0.1)', borderColor: 'rgba(124, 58, 237, 0.2)', color: '#7c3aed' }}>
            <Search className="w-7 h-7" />
=======
          <h1 className="text-2xl font-bold text-[var(--text-base)]">{t.title}</h1>
          <HelpTooltip section="keywords" />
        </div>
        <p className="text-[var(--text-muted)] text-sm">{t.subtitle}</p>
      </div>

      {/* Demo notice */}
      <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
        <span className="text-amber-400 text-base mt-0.5 flex-shrink-0">⚠️</span>
        <p className="text-amber-300/80 text-xs leading-relaxed">
          <span className="font-semibold text-amber-300">{t.demoNotice}</span>{' '}
          {t.demoDesc}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t.kpiImpressions, value: fmt(mockKeywords.reduce((s, r) => s + r.impressions, 0)) },
          { label: t.kpiClicks,      value: fmt(mockKeywords.reduce((s, r) => s + r.clicks, 0)) },
          { label: t.kpiCtr,         value: (mockKeywords.reduce((s, r) => s + r.ctr, 0) / mockKeywords.length).toFixed(2) + '%' },
          { label: t.kpiGrowing,     value: mockKeywords.filter(r => r.trend === 'up').length + (t.kpiGrowingUnit ? ` ${t.kpiGrowingUnit}` : '') },
        ].map(c => (
          <div key={c.label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-4">
            <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide mb-1">{c.label}</p>
            <p className="font-bold text-lg text-[var(--text-base)]">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl pl-9 pr-4 py-2 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/60 transition-all"
            />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl w-fit">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === t.key
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
                }`}
              >
                {t.label}
              </button>
            ))}
>>>>>>> origin/claude/friendly-rubin-IkT6S
          </div>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text-base)' }}>{d.noDataYet}</h2>
          <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>{d.noDataDesc}</p>
        </div>
<<<<<<< HEAD
      ) : (
        <KeywordsView phrases={phrases} />
      )}
=======

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] text-xs border-b border-white/[0.05] bg-white/[0.01]">
                <th className="text-left font-medium px-5 py-3">{t.colProduct}</th>
                <th className="text-left font-medium px-4 py-3">{t.colKeywords}</th>
                <th className="text-right font-medium px-4 py-3">{t.colImpressions}</th>
                <th className="text-right font-medium px-4 py-3">{t.colClicks}</th>
                <th className="text-right font-medium px-4 py-3">{t.colCtr}</th>
                <th className="text-right font-medium px-4 py-3">{t.colPosition}</th>
                <th className="text-right font-medium px-4 py-3">{t.colTrend}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[var(--text-muted)] text-sm">
                    {t.notFound}
                  </td>
                </tr>
              ) : filtered.map(row => (
                <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-[var(--text-base)] font-medium text-xs">{row.productName}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {row.keywords.slice(0, 5).map(kw => (
                        <span
                          key={kw}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[var(--text-dim)] text-xs font-medium">
                    {fmt(row.impressions)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-[var(--text-dim)] text-xs font-medium">
                    {fmt(row.clicks)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`text-xs font-bold ${
                      row.ctr >= 4 ? 'text-emerald-400' :
                      row.ctr >= 2 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {row.ctr.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`text-xs font-bold ${
                      row.position <= 3 ? 'text-emerald-400' :
                      row.position <= 8 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      #{row.position.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex justify-end">
                      <TrendIcon trend={row.trend} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-white/[0.04] text-xs text-[var(--text-muted)]">
            {filtered.length} {t.showing}
          </div>
        )}
      </div>
>>>>>>> origin/claude/friendly-rubin-IkT6S
    </div>
  )
}
