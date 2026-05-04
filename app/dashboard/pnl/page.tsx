import { FileText } from 'lucide-react'
import { products, orders, productAds, uzumCommissions } from '@/lib/mock-data'
import PnlChart from './PnlChart'
import ExportButton from '@/components/dashboard/ExportButton'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

// Build monthly P&L from mock orders (last 6 months)
function buildMonthlyPnl() {
  const months: Record<string, { revenue: number; cost: number; commission: number; adSpend: number; logistics: number }> = {}

  // Seed 6 months of data from orders + patterns
  const baseMonths = ['Noy', 'Dek', 'Yan', 'Fev', 'Mar', 'Apr']
  const baseRevenue = [68_000_000, 84_000_000, 72_000_000, 91_000_000, 108_000_000, 124_500_000]

  baseMonths.forEach((m, i) => {
    const rev  = baseRevenue[i]
    const cogs = rev * 0.57   // avg cost ratio
    const comm = rev * 0.075  // avg 7.5% commission
    const ads  = rev * 0.078  // avg 7.8% ad ratio
    const logi = rev * 0.03   // 3% logistics
    months[m] = { revenue: rev, cost: cogs, commission: comm, adSpend: ads, logistics: logi }
  })

  return baseMonths.map(m => {
    const d = months[m]
    const grossProfit = d.revenue - d.cost - d.commission - d.logistics
    const netProfit   = grossProfit - d.adSpend
    const margin      = (netProfit / d.revenue) * 100
    return {
      month:      m,
      revenue:    d.revenue,
      cost:       d.cost,
      commission: d.commission,
      adSpend:    d.adSpend,
      logistics:  d.logistics,
      grossProfit,
      netProfit,
      margin,
    }
  })
}

const monthlyData = buildMonthlyPnl()
const totalRevenue    = monthlyData.reduce((s, m) => s + m.revenue, 0)
const totalCost       = monthlyData.reduce((s, m) => s + m.cost, 0)
const totalCommission = monthlyData.reduce((s, m) => s + m.commission, 0)
const totalAds        = monthlyData.reduce((s, m) => s + m.adSpend, 0)
const totalLogistics  = monthlyData.reduce((s, m) => s + m.logistics, 0)
const totalProfit     = monthlyData.reduce((s, m) => s + m.netProfit, 0)

const exportData = monthlyData.map(m => ({
  'Oy': m.month,
  "Daromad (so'm)": Math.round(m.revenue),
  "Tannarx (so'm)": Math.round(m.cost),
  "Komissiya (so'm)": Math.round(m.commission),
  "Reklama (so'm)": Math.round(m.adSpend),
  "Logistika (so'm)": Math.round(m.logistics),
  "Sof foyda (so'm)": Math.round(m.netProfit),
  'Margin (%)': m.margin.toFixed(1),
}))

export default function PnlPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-violet-400" />
            Foyda va zarar hisoboti
          </h1>
          <p className="text-slate-400 text-sm mt-1">So&apos;nggi 6 oy · Barcha xarajatlar hisobga olingan</p>
        </div>
        <ExportButton data={exportData} filename="pnl-hisoboti" />
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Jami daromad',   value: fmt(totalRevenue),    color: 'text-violet-400' },
          { label: 'Jami xarajat',   value: fmt(totalCost + totalCommission + totalAds + totalLogistics), color: 'text-red-400' },
          { label: 'Sof foyda',      value: fmt(totalProfit),     color: totalProfit > 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'O\'rtacha margin', value: `${(totalProfit / totalRevenue * 100).toFixed(1)}%`, color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-slate-500 text-xs mb-2">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <PnlChart data={monthlyData.map(m => ({
        month: m.month, revenue: m.revenue, cost: m.cost,
        adSpend: m.adSpend, profit: m.netProfit,
      }))} />

      {/* Monthly table */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-white/[0.05] bg-white/[0.01]">
                <th className="text-left font-medium px-5 py-3">Oy</th>
                <th className="text-right font-medium px-5 py-3">Daromad</th>
                <th className="text-right font-medium px-5 py-3">Tannarx</th>
                <th className="text-right font-medium px-5 py-3">Komissiya</th>
                <th className="text-right font-medium px-5 py-3">Reklama</th>
                <th className="text-right font-medium px-5 py-3">Logistika</th>
                <th className="text-right font-medium px-5 py-3">Sof foyda</th>
                <th className="text-right font-medium px-5 py-3">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {monthlyData.map((m, i) => (
                <tr key={m.month} className={`hover:bg-white/[0.02] transition-colors ${i === monthlyData.length - 1 ? 'bg-white/[0.01]' : ''}`}>
                  <td className="px-5 py-4 text-white font-medium">
                    {m.month}
                    {i === monthlyData.length - 1 && <span className="ml-2 text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">joriy</span>}
                  </td>
                  <td className="px-5 py-4 text-right text-slate-300">{fmt(m.revenue)}</td>
                  <td className="px-5 py-4 text-right text-red-400/70">{fmt(m.cost)}</td>
                  <td className="px-5 py-4 text-right text-red-400/70">{fmt(m.commission)}</td>
                  <td className="px-5 py-4 text-right text-amber-400/80">{fmt(m.adSpend)}</td>
                  <td className="px-5 py-4 text-right text-red-400/70">{fmt(m.logistics)}</td>
                  <td className="px-5 py-4 text-right">
                    <span className={`font-bold ${m.netProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(m.netProfit)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={`text-sm font-semibold ${m.margin > 20 ? 'text-emerald-400' : m.margin > 10 ? 'text-amber-400' : 'text-red-400'}`}>
                      {m.margin.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-white/[0.03] border-t border-white/[0.08]">
                <td className="px-5 py-4 text-white font-bold text-xs uppercase tracking-wide">Jami</td>
                <td className="px-5 py-4 text-right text-white font-bold">{fmt(totalRevenue)}</td>
                <td className="px-5 py-4 text-right text-red-400 font-bold">{fmt(totalCost)}</td>
                <td className="px-5 py-4 text-right text-red-400 font-bold">{fmt(totalCommission)}</td>
                <td className="px-5 py-4 text-right text-amber-400 font-bold">{fmt(totalAds)}</td>
                <td className="px-5 py-4 text-right text-red-400 font-bold">{fmt(totalLogistics)}</td>
                <td className="px-5 py-4 text-right">
                  <span className="text-emerald-400 font-bold">{fmt(totalProfit)}</span>
                </td>
                <td className="px-5 py-4 text-right">
                  <span className="text-emerald-400 font-bold">{(totalProfit / totalRevenue * 100).toFixed(1)}%</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
