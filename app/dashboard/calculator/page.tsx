'use client'

import { useState, useMemo } from 'react'
import { Calculator, TrendingUp, TrendingDown, AlertTriangle, Info, Zap } from 'lucide-react'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'
import HelpTooltip from '@/components/dashboard/HelpTooltip'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

const CATEGORY_RATES = [5, 5, 6, 8, 8, 9, 7, 10, 10, 10, 11, 9, 12, 10, 6, 10]

const inputCls = "w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"

export default function CalculatorPage() {
  const { lang } = useLang()
  const t = dashT[lang].calculator
  const CATEGORIES = t.categories.map((name, i) => ({ name, rate: CATEGORY_RATES[i] }))
  const [price,      setPrice]      = useState('')
  const [cost,       setCost]       = useState('')
  const [logistics,  setLogistics]  = useState('')
  const [adSpend,    setAdSpend]    = useState('')
  const [returnRate, setReturnRate] = useState('5')
  const [units,      setUnits]      = useState('100')
  const [catIdx,     setCatIdx]     = useState(0)

  const commission = CATEGORIES[catIdx].rate

  const result = useMemo(() => {
    const p  = parseFloat(price)      || 0
    const c  = parseFloat(cost)       || 0
    const l  = parseFloat(logistics)  || 0
    const ad = parseFloat(adSpend)    || 0
    const rr = parseFloat(returnRate) / 100
    const u  = Math.max(1, parseInt(units) || 1)
    if (p <= 0 || c <= 0) return null

    // What the seller THINKS they made (naive)
    const naiveProfit      = (p - c) * u
    const naiveProfitUnit  = p - c

    // Deductions per unit
    const commAmt      = p * (commission / 100)
    const returnLoss   = p * rr                          // lost revenue on returns
    const returnLogist = l * rr                          // extra logistics for returns
    const netRevenue   = p * (1 - rr) - commAmt

    const realProfitUnit = netRevenue - c - l - (ad / u)
    const realProfit     = realProfitUnit * u

    const stolen         = naiveProfit - realProfit       // what Uzum/costs "steal"
    const stolenPct      = naiveProfit > 0 ? (stolen / naiveProfit) * 100 : 0
    const keepPct        = 100 - stolenPct

    const margin         = p > 0 ? (realProfitUnit / p) * 100 : 0
    const drr            = p * u > 0 ? (ad / (p * u)) * 100 : 0
    const roi            = c > 0 ? (realProfitUnit / c) * 100 : 0
    const breakeven      = c + l + commAmt + (ad / u) + (p * rr * 0.05)

    return {
      naiveProfitUnit, naiveProfit,
      realProfitUnit,  realProfit,
      stolen,          stolenPct, keepPct,
      commAmt, returnLoss, returnLogist,
      adPerUnit: ad / u,
      margin, drr, roi, breakeven,
      units: u, price: p, cost: c, logistics: l, adSpend: ad,
    }
  }, [price, cost, logistics, adSpend, returnRate, units, commission])

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold text-[var(--text-base)] flex items-center gap-2">
            <Calculator className="w-6 h-6 text-violet-400" />
            {t.title}
          </h1>
          <HelpTooltip section="calculator" />
        </div>
        <p className="text-[var(--text-muted)] text-sm">
          {t.subtitlePre} <strong className="text-[var(--text-base)]">{t.subtitleStrong}</strong> {t.subtitlePost}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Inputs ──────────────────────────────────────────────────── */}
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{t.productInfo}</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">{t.sellPrice}</label>
              <input value={price} onChange={e => setPrice(e.target.value)} type="number"
                placeholder="890 000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">{t.cost}</label>
              <input value={cost} onChange={e => setCost(e.target.value)} type="number"
                placeholder="520 000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">{t.logistics}</label>
              <input value={logistics} onChange={e => setLogistics(e.target.value)} type="number"
                placeholder="25 000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">{t.adSpend}</label>
              <input value={adSpend} onChange={e => setAdSpend(e.target.value)} type="number"
                placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">{t.returnRate}</label>
              <input value={returnRate} onChange={e => setReturnRate(e.target.value)} type="number"
                placeholder="5" min="0" max="100" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">{t.monthlyUnits}</label>
              <input value={units} onChange={e => setUnits(e.target.value)} type="number"
                placeholder="100" min="1" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">{t.category}</label>
            <select value={catIdx} onChange={e => setCatIdx(Number(e.target.value))} className={inputCls}>
              {CATEGORIES.map((c, i) => (
                <option key={c.name} value={i}>{c.name} — {c.rate}% {t.commissionSuffix}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-violet-500/[0.07] border border-violet-500/10 rounded-xl px-4 py-2.5">
            <Info className="w-4 h-4 text-violet-400 flex-shrink-0" />
            <p className="text-xs text-[var(--text-muted)]">
              {t.uzumCommission} <span className="text-violet-400 font-semibold">{commission}%</span> · {CATEGORIES[catIdx].name}
            </p>
          </div>
        </div>

        {/* ── Results ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {!result ? (
            <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6 flex flex-col items-center justify-center min-h-[220px] gap-3">
              <Calculator className="w-10 h-10 text-[var(--text-dim)]" />
              <p className="text-[var(--text-muted)] text-sm text-center">{t.enterToSee}<br/>{t.enterPriceCost}</p>
            </div>
          ) : (
            <>
              {/* ── REALITY CHECK ─────────────────────────────────────── */}
              <div className="rounded-2xl overflow-hidden border border-[var(--border2)]">
                <div className="bg-gradient-to-r from-violet-600/20 to-indigo-600/10 px-5 py-3 border-b border-[var(--border)] flex items-center gap-2">
                  <Zap className="w-4 h-4 text-violet-400" />
                  <span className="text-[var(--text-base)] font-bold text-sm">{t.realityCheck}</span>
                </div>

                <div className="bg-[var(--bg-card2)] p-5 space-y-4">
                  {/* Two-column comparison */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl p-4">
                      <p className="text-[var(--text-muted)] text-[11px] mb-1">{t.youThink}</p>
                      <p className="text-[var(--text-base)] font-bold text-xl">{fmt(result.naiveProfit)}</p>
                      <p className="text-[var(--text-muted)] text-[10px] mt-0.5">so'm</p>
                    </div>
                    <div className={`border rounded-xl p-4 ${result.realProfit > 0 ? 'bg-emerald-500/[0.08] border-emerald-500/25' : 'bg-red-500/[0.08] border-red-500/25'}`}>
                      <p className="text-[var(--text-muted)] text-[11px] mb-1">{t.yourReal}</p>
                      <p className={`font-bold text-xl ${result.realProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmt(result.realProfit)}
                      </p>
                      <p className="text-[var(--text-muted)] text-[10px] mt-0.5">so'm</p>
                    </div>
                  </div>

                  {/* The "stolen" line */}
                  <div className="bg-red-500/[0.07] border border-red-500/20 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-red-400 text-xs font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {t.uzumTook}
                      </span>
                      <span className="text-red-400 font-bold text-sm">{fmt(result.stolen)} so'm</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(0, Math.min(100, result.keepPct))}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] mt-1.5">
                      <span className="text-emerald-400">{t.kept} {result.keepPct.toFixed(0)}%</span>
                      <span className="text-red-400">{t.gone} {result.stolenPct.toFixed(0)}%</span>
                    </div>
                  </div>

                  {/* Cost breakdown per unit */}
                  <div className="space-y-1.5">
                    <p className="text-[var(--text-muted)] text-xs font-medium">{t.breakdownTitle}</p>
                    {[
                      { label: `${t.bdCommission} (${commission}%)`, value: result.commAmt,     color: 'bg-red-500' },
                      { label: t.bdCost,                            value: result.cost,         color: 'bg-orange-500' },
                      { label: t.bdLogistics,                       value: result.logistics,    color: 'bg-amber-500' },
                      { label: t.bdReturnLoss,                      value: result.returnLoss * (parseFloat(returnRate)/100), color: 'bg-rose-500' },
                      { label: t.bdAd,                              value: result.adPerUnit,    color: 'bg-purple-500' },
                    ].filter(r => r.value > 0).map(r => {
                      const pct = result.price > 0 ? (r.value / result.price) * 100 : 0
                      return (
                        <div key={r.label} className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.color}`} />
                          <span className="text-[var(--text-muted)] flex-1">{r.label}</span>
                          <span className="text-[var(--text-dim)] tabular-nums">{fmt(r.value)} so'm</span>
                          <span className="text-[var(--text-muted)] w-10 text-right tabular-nums">{pct.toFixed(1)}%</span>
                        </div>
                      )
                    })}
                    <div className="border-t border-[var(--border)] pt-1.5 flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-500" />
                      <span className="text-[var(--text-base)] font-semibold flex-1">{t.netProfitUnit}</span>
                      <span className={`font-bold tabular-nums ${result.realProfitUnit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmt(result.realProfitUnit)} so'm
                      </span>
                      <span className={`w-10 text-right tabular-nums font-semibold ${result.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {result.margin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metric chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: t.margin,    value: `${result.margin.toFixed(1)}%`,    good: result.margin >= 20,  bad: result.margin < 5   },
                  { label: t.roi,       value: `${result.roi.toFixed(0)}%`,        good: result.roi >= 30,     bad: result.roi < 0      },
                  { label: t.drr,       value: `${result.drr.toFixed(1)}%`,        good: result.drr < 15,      bad: result.drr > 25     },
                  { label: t.breakeven, value: `${fmt(result.breakeven)} s'm`, good: result.price > result.breakeven, bad: result.price <= result.breakeven },
                ].map(({ label, value, good, bad }) => (
                  <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl p-3">
                    <p className="text-[var(--text-muted)] text-[10px] mb-0.5">{label}</p>
                    <p className={`text-base font-bold ${good ? 'text-emerald-400' : bad ? 'text-red-400' : 'text-amber-400'}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Warnings */}
              {result.realProfit <= 0 && (
                <div className="flex items-start gap-2 bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{t.warnLossPre} <strong>{fmt(Math.abs(result.realProfit))} {t.warnLossStrong}</strong> {t.warnLossMid} <strong>{fmt(result.breakeven)} {t.warnLossEnd}</strong></span>
                </div>
              )}
              {result.margin > 0 && result.margin < 15 && (
                <div className="flex items-start gap-2 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{t.warnMarginPre} {result.margin.toFixed(1)}% {t.warnMarginPost}</span>
                </div>
              )}
              {result.drr > 25 && (
                <div className="flex items-start gap-2 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400">
                  <TrendingDown className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{t.warnDrrPre} {result.drr.toFixed(1)}% {t.warnDrrPost}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
