'use client'

import { useState, useMemo } from 'react'
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import HelpTooltip from '@/components/dashboard/HelpTooltip'

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
  return <Minus className="w-3.5 h-3.5 text-slate-500" />
}

// ── Page ───────────────────────────────────────────────────────────────────────

type Tab = 'all' | 'growing' | 'declining'

export default function KeywordsPage() {
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
    { key: 'all',      label: 'Barcha'          },
    { key: 'growing',  label: "O'sib borayotgan" },
    { key: 'declining',label: 'Tushib borayotgan'},
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold text-white">Qidiruv iboralari</h1>
          <HelpTooltip section="keywords" />
        </div>
        <p className="text-slate-400 text-sm">
          Har bir mahsulotingiz qaysi kalit so'zlar orqali topilayotgani, nechta taassurot va
          bosish olayotgani haqidagi ma'lumotlar. CTR va o'rtacha pozitsiyani kuzatib boring.
        </p>
      </div>

      {/* Demo notice */}
      <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
        <span className="text-amber-400 text-base mt-0.5 flex-shrink-0">⚠️</span>
        <p className="text-amber-300/80 text-xs leading-relaxed">
          <span className="font-semibold text-amber-300">Demo ko'rinish.</span>{' '}
          Quyidagi raqamlar namunali ma'lumotlar — sizning haqiqiy mahsulotlaringiz emas.
          Uzum Market qidiruv tahlili funksiyasi hali ishlab chiqilmoqda.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Jami taassurotlar', value: fmt(mockKeywords.reduce((s, r) => s + r.impressions, 0)) },
          { label: 'Jami bosishlar',    value: fmt(mockKeywords.reduce((s, r) => s + r.clicks, 0)) },
          { label: "O'rtacha CTR",      value: (mockKeywords.reduce((s, r) => s + r.ctr, 0) / mockKeywords.length).toFixed(2) + '%' },
          { label: "O'sib borayotgan",  value: mockKeywords.filter(r => r.trend === 'up').length + ' ta' },
        ].map(c => (
          <div key={c.label} className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-4">
            <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">{c.label}</p>
            <p className="font-bold text-lg text-white">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Mahsulot yoki kalit so'z..."
              className="w-full bg-[#1c1c2e] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60 transition-all"
            />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[#1c1c2e] border border-white/[0.06] rounded-xl w-fit">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === t.key
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-white/[0.05] bg-white/[0.01]">
                <th className="text-left font-medium px-5 py-3">Mahsulot nomi</th>
                <th className="text-left font-medium px-4 py-3">Kalit so'zlar</th>
                <th className="text-right font-medium px-4 py-3">Taassurotlar</th>
                <th className="text-right font-medium px-4 py-3">Bosishlar</th>
                <th className="text-right font-medium px-4 py-3">CTR</th>
                <th className="text-right font-medium px-4 py-3">Pozitsiya</th>
                <th className="text-right font-medium px-4 py-3">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500 text-sm">
                    Natija topilmadi
                  </td>
                </tr>
              ) : filtered.map(row => (
                <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-white font-medium text-xs">{row.productName}</p>
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
                  <td className="px-4 py-3.5 text-right text-slate-300 text-xs font-medium">
                    {fmt(row.impressions)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-300 text-xs font-medium">
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
          <div className="px-5 py-3 border-t border-white/[0.04] text-xs text-slate-600">
            {filtered.length} ta mahsulot ko'rsatilmoqda
          </div>
        )}
      </div>
    </div>
  )
}
