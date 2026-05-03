import { products, productAds } from '@/lib/mock-data'
import { AlertTriangle, TrendingDown, Zap, BarChart2 } from 'lucide-react'
import AdDrrChart from './AdDrrChart'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

// Build enriched product ad rows
const adRows = products.map(p => {
  const ad = productAds[p.id] ?? { adSpend: 0, clicks: 0, adOrders: 0 }
  const totalRevenue   = p.price * p.sold
  const adRevenue      = p.price * ad.adOrders
  const organicOrders  = p.sold - ad.adOrders
  const organicRevenue = p.price * organicOrders
  const drrTotal       = totalRevenue > 0 ? (ad.adSpend / totalRevenue) * 100 : 0
  const drrAd          = adRevenue   > 0 ? (ad.adSpend / adRevenue)    * 100 : 0
  const cpo            = ad.adOrders > 0 ? ad.adSpend / ad.adOrders    : 0
  const cpc            = ad.clicks   > 0 ? ad.adSpend / ad.clicks      : 0
  const spendNoSales   = ad.adOrders === 0 && ad.adSpend > 0
  const overspend      = drrTotal > 25
  return {
    ...p, ...ad,
    totalRevenue, adRevenue, organicOrders, organicRevenue,
    drrTotal, drrAd, cpo, cpc, spendNoSales, overspend,
  }
})

const totalAdSpend   = adRows.reduce((s, r) => s + r.adSpend, 0)
const totalAdOrders  = adRows.reduce((s, r) => s + r.adOrders, 0)
const totalRevenue   = adRows.reduce((s, r) => s + r.totalRevenue, 0)
const avgDrr         = totalRevenue > 0 ? (totalAdSpend / totalRevenue) * 100 : 0
const spendNoSalesCount = adRows.filter(r => r.spendNoSales).length
const overspendCount    = adRows.filter(r => r.overspend).length

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-violet-400" />
          Reklama analitikasi
        </h1>
        <p className="text-slate-400 text-sm mt-1">DRR, CPC, CPO va organik savdolar tahlili</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Jami reklama xarajati', value: `${fmt(totalAdSpend)} so'm`, sub: 'so\'m', color: 'text-violet-400' },
          { label: 'O\'rtacha DRR',          value: `${avgDrr.toFixed(1)}%`,              color: avgDrr > 20 ? 'text-amber-400' : 'text-emerald-400' },
          { label: 'Reklama orqali buyurtma',value: totalAdOrders.toLocaleString('uz-UZ'), color: 'text-blue-400' },
          { label: 'Muammoli mahsulotlar',   value: String(spendNoSalesCount + overspendCount), color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-slate-500 text-xs mb-2">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {(spendNoSalesCount > 0 || overspendCount > 0) && (
        <div className="space-y-2">
          {adRows.filter(r => r.spendNoSales).map(r => (
            <div key={r.id} className="flex items-center gap-3 bg-red-500/[0.07] border border-red-500/20 rounded-xl px-4 py-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-red-300 font-medium">{r.name}</span>
              <span className="text-red-400/70">— {fmt(r.adSpend)} so'm xarajat qilingan, lekin birorta ham buyurtma yo'q (savdosiz xarajat)</span>
            </div>
          ))}
          {adRows.filter(r => r.overspend && !r.spendNoSales).map(r => (
            <div key={r.id} className="flex items-center gap-3 bg-amber-500/[0.07] border border-amber-500/20 rounded-xl px-4 py-3 text-sm">
              <TrendingDown className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-amber-300 font-medium">{r.name}</span>
              <span className="text-amber-400/70">— DRR {r.drrTotal.toFixed(1)}% (25% dan yuqori) — reklama xarajati haddan oshgan</span>
            </div>
          ))}
        </div>
      )}

      {/* DRR chart */}
      <AdDrrChart rows={adRows.map(r => ({ name: r.name, drrTotal: r.drrTotal, drrAd: r.drrAd }))} />

      {/* Full table */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">Mahsulotlar bo&apos;yicha reklama tahlili</h2>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" /> DRR (umumiy)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> DRR (reklama)</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-white/[0.05] bg-white/[0.01]">
                <th className="text-left font-medium px-5 py-3">Mahsulot</th>
                <th className="text-right font-medium px-4 py-3">Xarajat</th>
                <th className="text-right font-medium px-4 py-3">DRR umumiy</th>
                <th className="text-right font-medium px-4 py-3">DRR reklama</th>
                <th className="text-right font-medium px-4 py-3">CPO</th>
                <th className="text-right font-medium px-4 py-3">CPC</th>
                <th className="text-right font-medium px-4 py-3">Organik</th>
                <th className="text-right font-medium px-4 py-3">Reklama</th>
                <th className="text-center font-medium px-4 py-3">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {adRows.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-white font-medium">{r.name}</p>
                    <p className="text-slate-500 text-xs">{r.sku}</p>
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-300">{fmt(r.adSpend)} so'm</td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`font-semibold ${r.drrTotal > 25 ? 'text-red-400' : r.drrTotal > 15 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {r.drrTotal.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`font-semibold ${r.drrAd > 40 ? 'text-red-400' : r.drrAd > 25 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {r.drrAd > 0 ? `${r.drrAd.toFixed(1)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-300">
                    {r.cpo > 0 ? `${fmt(r.cpo)} so'm` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-300">
                    {r.cpc > 0 ? `${fmt(r.cpc)} so'm` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div>
                      <p className="text-slate-300">{r.organicOrders} dona</p>
                      <p className="text-slate-500 text-xs">{fmt(r.organicRevenue)} so'm</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div>
                      <p className="text-slate-300">{r.adOrders} dona</p>
                      <p className="text-slate-500 text-xs">{fmt(r.adRevenue)} so'm</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {r.spendNoSales ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                        <AlertTriangle className="w-3 h-3" /> Savdosiz
                      </span>
                    ) : r.overspend ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <TrendingDown className="w-3 h-3" /> Yuqori
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Zap className="w-3 h-3" /> Yaxshi
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRR explanation */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-5 space-y-2">
        <h3 className="text-white text-sm font-semibold">DRR nima?</h3>
        <p className="text-slate-400 text-xs leading-relaxed">
          <strong className="text-slate-300">DRR (Reklama xarajatlari ulushi)</strong> — reklama xarajatining daromadga nisbati.
          Ikki hisoblash usuli mavjud:
        </p>
        <ul className="text-xs text-slate-400 space-y-1 pl-4 list-disc">
          <li><strong className="text-violet-400">DRR umumiy</strong> — xarajat ÷ umumiy daromad (organik + reklama). Mahsulot rentabelligini ko&apos;rsatadi.</li>
          <li><strong className="text-blue-400">DRR reklama</strong> — xarajat ÷ faqat reklama orqali kelgan daromad. Sof reklama samaradorligini o&apos;lchaydi.</li>
        </ul>
        <p className="text-xs text-slate-500">Optimal DRR: <span className="text-emerald-400">10–20%</span> · Yuqori: <span className="text-amber-400">20–25%</span> · Juda yuqori: <span className="text-red-400">&gt;25%</span></p>
      </div>
    </div>
  )
}
