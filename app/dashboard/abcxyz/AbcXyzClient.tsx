'use client'

import { useState, useMemo } from 'react'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

interface ClassifiedProduct {
  id: string
  title: string
  sku: string | null
  revenue: number
  revenueShare: number
  sold: number
  abc: string
  xyz: string
  combined: string
}

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

const ABC_CFG = {
  A: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  B: { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400',   dot: 'bg-amber-400'   },
  C: { bg: 'bg-red-500/10',     border: 'border-red-500/20',     text: 'text-red-400',     dot: 'bg-red-400'     },
}
const XYZ_CFG = {
  X: { bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   text: 'text-blue-400'   },
  Y: { bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  text: 'text-amber-400'  },
<<<<<<< HEAD
  Z: { bg: 'bg-slate-500/10',  border: 'border-[var(--border)]',  text: 'text-[var(--text-muted)]'  },
=======
  Z: { bg: 'bg-slate-500/10',  border: 'border-slate-500/20',  text: 'text-[var(--text-muted)]'  },
>>>>>>> origin/claude/friendly-rubin-IkT6S
}

export default function AbcXyzClient({ products }: { products: ClassifiedProduct[] }) {
  const { lang } = useLang()
  const t = dashT[lang].abcxyz
  const [filter, setFilter] = useState('all')

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: products.length }
    for (const p of products) {
      c[p.abc]      = (c[p.abc]      ?? 0) + 1
      c[p.xyz]      = (c[p.xyz]      ?? 0) + 1
      c[p.combined] = (c[p.combined] ?? 0) + 1
    }
    return c
  }, [products])

  const filtered = useMemo(() =>
    filter === 'all'
      ? products
      : products.filter(p => p.abc === filter || p.xyz === filter || p.combined === filter)
  , [products, filter])

  const FILTERS = [
    { id: 'all', label: t.all },
    { id: 'A', label: 'A' }, { id: 'B', label: 'B' }, { id: 'C', label: 'C' },
    { id: 'X', label: 'X' }, { id: 'Y', label: 'Y' }, { id: 'Z', label: 'Z' },
  ]

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: t.classA, count: counts['A'] ?? 0, cfg: ABC_CFG.A },
          { label: t.classB, count: counts['B'] ?? 0, cfg: ABC_CFG.B },
          { label: t.classC, count: counts['C'] ?? 0, cfg: ABC_CFG.C },
        ]).map(({ label, count, cfg }) => (
          <div key={label} className={`${cfg.bg} border ${cfg.border} rounded-2xl p-5`}>
            <p className={`text-3xl font-bold ${cfg.text}`}>{count}</p>
            <p className="text-[var(--text-muted)] text-xs mt-1.5 leading-snug">{label}</p>
          </div>
        ))}
      </div>

      {/* Interpretation panel */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-5">
        <p className="text-[var(--text-base)] font-semibold text-sm mb-3">{t.interpretation}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { cls: 'AX', desc: t.axDesc, color: 'text-emerald-400' },
            { cls: 'AZ', desc: t.azDesc, color: 'text-amber-400'   },
            { cls: 'CX', desc: t.cxDesc, color: 'text-blue-400'    },
            { cls: 'CZ', desc: t.czDesc, color: 'text-red-400'     },
          ]).map(({ cls, desc, color }) => (
            <div key={cls} className="flex items-start gap-2.5">
              <span className={`text-xs font-bold ${color} w-6 flex-shrink-0 pt-0.5`}>{cls}</span>
              <span className="text-[var(--text-muted)] text-xs leading-relaxed">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              filter === id
                ? 'bg-violet-600 text-[var(--text-base)] shadow-sm'
                : 'bg-[var(--bg-card2)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-base)]'
            }`}
          >
            {label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${filter === id ? 'bg-white/20' : 'bg-[var(--bg-input)]'}`}>
              {counts[id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
<<<<<<< HEAD
              <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)] bg-[var(--bg-card2)]">
=======
              <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)] bg-white/[0.01]">
>>>>>>> origin/claude/friendly-rubin-IkT6S
                <th className="text-left font-medium px-5 py-3">{t.product}</th>
                <th className="text-right font-medium px-5 py-3">{t.revenue}</th>
                <th className="text-right font-medium px-5 py-3">{t.revenueShare}</th>
                <th className="text-right font-medium px-5 py-3">{t.sold}</th>
                <th className="text-center font-medium px-5 py-3">{t.abcClass}</th>
                <th className="text-center font-medium px-5 py-3">{t.xyzClass}</th>
                <th className="text-center font-medium px-5 py-3">{t.combined}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[var(--text-muted)] text-sm">{t.noData}</td>
                </tr>
              ) : filtered.map(p => {
                const abcCfg = ABC_CFG[p.abc as keyof typeof ABC_CFG]
                const xyzCfg = XYZ_CFG[p.xyz as keyof typeof XYZ_CFG]
                return (
                  <tr key={p.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-[var(--text-base)] font-medium text-xs truncate max-w-[220px]">{p.title}</p>
                      {p.sku && <p className="text-[var(--text-muted)] text-xs mt-0.5">{p.sku}</p>}
                    </td>
                    <td className="px-5 py-3 text-right text-[var(--text-base)] text-xs font-semibold">{fmt(p.revenue)}</td>
                    <td className="px-5 py-3 text-right text-[var(--text-muted)] text-xs">{p.revenueShare.toFixed(1)}%</td>
                    <td className="px-5 py-3 text-right text-[var(--text-dim)] text-xs">{p.sold}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border ${abcCfg.bg} ${abcCfg.text} ${abcCfg.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${abcCfg.dot}`} />
                        {p.abc}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-lg border ${xyzCfg.bg} ${xyzCfg.text} ${xyzCfg.border}`}>
                        {p.xyz}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-lg border ${abcCfg.bg} ${abcCfg.text} ${abcCfg.border}`}>
                        {p.combined}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
