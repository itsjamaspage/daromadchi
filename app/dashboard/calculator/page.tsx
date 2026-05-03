'use client'

import { useState } from 'react'
import { Calculator, TrendingUp, TrendingDown, Info } from 'lucide-react'
import { uzumCommissions } from '@/lib/mock-data'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

const CATEGORIES = Object.keys(uzumCommissions)

interface Result {
  grossProfit:    number
  netProfit:      number
  margin:         number
  drr:            number
  breakeven:      number
  unitEconomics:  number
  roiPercent:     number
}

export default function CalculatorPage() {
  const [price,       setPrice]       = useState('')
  const [cost,        setCost]        = useState('')
  const [logistics,   setLogistics]   = useState('')
  const [adSpend,     setAdSpend]     = useState('')
  const [returnRate,  setReturnRate]  = useState('10')
  const [category,    setCategory]    = useState('Krossovkalar')
  const [units,       setUnits]       = useState('1')

  const commission = uzumCommissions[category] ?? 10

  function calculate(): Result | null {
    const p  = parseFloat(price)   || 0
    const c  = parseFloat(cost)    || 0
    const l  = parseFloat(logistics) || 0
    const ad = parseFloat(adSpend) || 0
    const rr = parseFloat(returnRate) / 100
    const u  = Math.max(1, parseFloat(units) || 1)

    if (p <= 0 || c <= 0) return null

    const commissionAmount = p * (commission / 100)
    // Returns cost seller extra logistics for returned items
    const returnCost = p * rr * (l / p || 0.05)
    const netRevenue = p * (1 - rr) - commissionAmount - returnCost

    const grossProfit   = netRevenue - c - l
    const adPerUnit     = ad / u
    const netProfit     = grossProfit - adPerUnit
    const margin        = (netProfit / p) * 100
    const drr           = p > 0 ? (ad / (p * u)) * 100 : 0
    const breakeven     = c + l + commissionAmount + adPerUnit + (p * rr * 0.05)
    const roiPercent    = c > 0 ? (netProfit / c) * 100 : 0

    return { grossProfit, netProfit, margin, drr, breakeven, unitEconomics: netProfit, roiPercent }
  }

  const result = calculate()

  const inputCls = "w-full bg-[#1c1c2e] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Calculator className="w-6 h-6 text-violet-400" />
          Unit-iqtisodiyot kalkulyatori
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Har bir mahsulot uchun sof foyda, margin va reklamani hisoblang
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-semibold text-sm mb-1">Mahsulot ma&apos;lumotlari</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Sotish narxi (so&apos;m)</label>
              <input value={price} onChange={e => setPrice(e.target.value)} type="number" placeholder="890 000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Tannarx (so&apos;m)</label>
              <input value={cost} onChange={e => setCost(e.target.value)} type="number" placeholder="520 000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Logistika (so&apos;m)</label>
              <input value={logistics} onChange={e => setLogistics(e.target.value)} type="number" placeholder="25 000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Reklama xarajati (so&apos;m)</label>
              <input value={adSpend} onChange={e => setAdSpend(e.target.value)} type="number" placeholder="12 000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Qaytarish foizi (%)</label>
              <input value={returnRate} onChange={e => setReturnRate(e.target.value)} type="number" placeholder="10" min="0" max="100" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Sotilgan dona</label>
              <input value={units} onChange={e => setUnits(e.target.value)} type="number" placeholder="1" min="1" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Kategoriya</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className={inputCls}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c} — {uzumCommissions[c]}% komissiya</option>
              ))}
            </select>
          </div>

          {/* Commission display */}
          <div className="flex items-center gap-2 bg-violet-500/[0.07] border border-violet-500/10 rounded-xl px-4 py-2.5">
            <Info className="w-4 h-4 text-violet-400 flex-shrink-0" />
            <p className="text-xs text-slate-400">
              Uzum Market komissiyasi: <span className="text-violet-400 font-semibold">{commission}%</span> ({category} kategoriyasi uchun)
            </p>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-3">
          {!result ? (
            <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-6 flex items-center justify-center h-full min-h-[200px]">
              <p className="text-slate-500 text-sm text-center">Natijani ko&apos;rish uchun<br/>narx va tannarxni kiriting</p>
            </div>
          ) : (
            <>
              {/* Main result card */}
              <div className={`rounded-2xl p-6 border ${
                result.netProfit > 0
                  ? 'bg-emerald-500/[0.07] border-emerald-500/20'
                  : 'bg-red-500/[0.07] border-red-500/20'
              }`}>
                <p className="text-slate-400 text-xs mb-1">Har bir mahsulotdan sof foyda</p>
                <div className="flex items-end gap-3">
                  <p className={`text-3xl font-bold ${result.netProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmt(result.netProfit)} so&apos;m
                  </p>
                  {result.netProfit > 0
                    ? <TrendingUp className="w-5 h-5 text-emerald-400 mb-1" />
                    : <TrendingDown className="w-5 h-5 text-red-400 mb-1" />
                  }
                </div>
              </div>

              {/* Metric grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Margin',        value: `${result.margin.toFixed(1)}%`,     good: result.margin > 15,  warn: result.margin < 5  },
                  { label: 'DRR (reklama)', value: `${result.drr.toFixed(1)}%`,         good: result.drr < 15,     warn: result.drr > 25    },
                  { label: 'ROI',           value: `${result.roiPercent.toFixed(0)}%`,  good: result.roiPercent > 30, warn: result.roiPercent < 0 },
                  { label: 'Zararlanmaslik narxi', value: `${fmt(result.breakeven)} so'm`, good: parseFloat(price) > result.breakeven, warn: parseFloat(price) <= result.breakeven },
                ].map(({ label, value, good, warn }) => (
                  <div key={label} className="bg-[#13131f] border border-white/[0.06] rounded-xl p-4">
                    <p className="text-slate-500 text-xs mb-1">{label}</p>
                    <p className={`text-lg font-bold ${good ? 'text-emerald-400' : warn ? 'text-red-400' : 'text-amber-400'}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Breakdown */}
              <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-5 space-y-2.5">
                <p className="text-white text-sm font-semibold mb-3">Taqsimot</p>
                {[
                  { label: 'Sotish narxi',     value: parseFloat(price) || 0,  color: 'text-white' },
                  { label: `Komissiya (${commission}%)`, value: -(parseFloat(price) || 0) * commission / 100, color: 'text-red-400' },
                  { label: 'Tannarx',          value: -(parseFloat(cost) || 0),       color: 'text-red-400' },
                  { label: 'Logistika',         value: -(parseFloat(logistics) || 0),  color: 'text-red-400' },
                  { label: 'Reklama (dona)',    value: -(parseFloat(adSpend) || 0) / Math.max(1, parseFloat(units) || 1), color: 'text-amber-400' },
                  { label: 'Sof foyda',        value: result.netProfit,               color: result.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400', bold: true },
                ].map(({ label, value, color, bold }) => (
                  <div key={label} className="flex items-center justify-between text-sm border-b border-white/[0.03] pb-2 last:border-0 last:pb-0">
                    <span className={`text-slate-400 ${bold ? 'font-semibold text-slate-200' : ''}`}>{label}</span>
                    <span className={`font-medium tabular-nums ${color}`}>
                      {value >= 0 ? '+' : ''}{fmt(value)} so&apos;m
                    </span>
                  </div>
                ))}
              </div>

              {/* Warnings */}
              {result.drr > 25 && (
                <div className="flex items-start gap-2 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400">
                  <span className="text-base leading-none">⚠️</span>
                  <span>DRR {result.drr.toFixed(1)}% — reklama xarajati juda yuqori. Optimal darajasi 15–20% oralig&apos;ida.</span>
                </div>
              )}
              {result.netProfit <= 0 && (
                <div className="flex items-start gap-2 bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400">
                  <span className="text-base leading-none">🚨</span>
                  <span>Hozirgi narx bilan zarar ko&apos;rmoqdasiz. Narxni {fmt(result.breakeven)} so&apos;mdan yuqori qiling.</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
