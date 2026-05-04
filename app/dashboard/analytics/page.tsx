import { BarChart2, Settings, TrendingUp, Package, Link2 } from 'lucide-react'
import Link from 'next/link'
import { getProducts } from '@/lib/db/products'
import { getKpis } from '@/lib/db/kpis'
import AdDrrChart from './AdDrrChart'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

export default async function AnalyticsPage() {
  const [products, kpis] = await Promise.all([getProducts(), getKpis(30)])
  const isEmpty = products.length === 0

  const avgMargin = products.length > 0
    ? products.reduce((s, p) => {
        const price = Number(p.selling_price ?? 0)
        return s + (price > 0 ? p.profit / price : 0)
      }, 0) / products.length * 100
    : 0

  const lowMarginCount  = products.filter(p => {
    const price = Number(p.selling_price ?? 0)
    return price > 0 && (p.profit / price) < 0.15
  }).length

  const highMarginCount = products.filter(p => {
    const price = Number(p.selling_price ?? 0)
    return price > 0 && (p.profit / price) >= 0.35
  }).length

  const totalStockValue = products.reduce((s, p) =>
    s + Number(p.cost_price ?? 0) * p.stock_quantity, 0)

  const sortedByMargin = [...products].sort((a, b) => {
    const ma = Number(a.selling_price ?? 0) > 0 ? a.profit / Number(a.selling_price) : 0
    const mb = Number(b.selling_price ?? 0) > 0 ? b.profit / Number(b.selling_price) : 0
    return mb - ma
  })

  const chartRows = sortedByMargin.slice(0, 10).map(p => ({
    name: p.title,
    drrTotal: Number(p.selling_price ?? 0) > 0 ? (p.profit / Number(p.selling_price)) * 100 : 0,
    drrAd: 0,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-violet-400" />
          Mahsulot tahlili
        </h1>
        <p className="text-slate-400 text-sm mt-1">Margin, qoldiq va daromad tahlili</p>
      </div>

      {isEmpty ? (
        <div className="bg-[#13131f] border border-dashed border-violet-500/30 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <BarChart2 className="w-7 h-7 text-violet-400" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">Tahlil uchun ma'lumot yo'q</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            Do'koningizni ulab, mahsulotlarni sinxronlashtiring — shunda bu sahifada to'liq tahlil ko'rinadi.
          </p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
            <Settings className="w-4 h-4" /> Sozlamalarga o'tish
          </Link>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Jami mahsulot',       value: products.length.toString(),  color: 'text-violet-400' },
              { label: "O'rtacha margin",      value: `${avgMargin.toFixed(1)}%`,  color: avgMargin >= 25 ? 'text-emerald-400' : 'text-amber-400' },
              { label: 'Past margin (<15%)',   value: lowMarginCount.toString(),   color: lowMarginCount > 0 ? 'text-red-400' : 'text-emerald-400' },
              { label: 'Yuqori margin (≥35%)', value: highMarginCount.toString(),  color: 'text-emerald-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-5">
                <p className="text-slate-500 text-xs mb-2">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Low-margin alerts */}
          {lowMarginCount > 0 && (
            <div className="space-y-2">
              {products
                .filter(p => {
                  const price = Number(p.selling_price ?? 0)
                  return price > 0 && (p.profit / price) < 0.15
                })
                .map(p => (
                  <div key={p.id} className="flex items-center gap-3 bg-red-500/[0.07] border border-red-500/20 rounded-xl px-4 py-3 text-sm">
                    <Package className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span className="text-red-300 font-medium">{p.title}</span>
                    <span className="text-red-400/70">
                      — margin {((p.profit / Number(p.selling_price)) * 100).toFixed(1)}% (15% dan past) · tannarx yoki narxni ko'rib chiqing
                    </span>
                  </div>
                ))}
            </div>
          )}

          {/* Top-10 margin chart */}
          <AdDrrChart rows={chartRows} />

          {/* Ad data notice */}
          <div className="flex items-start gap-3 bg-blue-500/[0.06] border border-blue-500/20 rounded-xl px-4 py-3 text-xs text-blue-400/80">
            <Link2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong className="text-blue-300">Reklama tahlili (DRR, CPC, CPO)</strong> — Uzum Ads API integratsiyasi yaqinda qo'shiladi.
              Hozircha mahsulot narxi va tannarxi asosida margin tahlili ko'rsatilmoqda.
            </span>
          </div>

          {/* Full margin table */}
          <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05]">
              <h2 className="text-white font-semibold text-sm">Mahsulotlar bo'yicha margin tahlili</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-white/[0.05] bg-white/[0.01]">
                    <th className="text-left font-medium px-5 py-3">Mahsulot</th>
                    <th className="text-right font-medium px-4 py-3">Narx</th>
                    <th className="text-right font-medium px-4 py-3">Tannarx</th>
                    <th className="text-right font-medium px-4 py-3">Foyda</th>
                    <th className="text-right font-medium px-4 py-3">Margin</th>
                    <th className="text-right font-medium px-4 py-3">Qoldiq</th>
                    <th className="text-right font-medium px-4 py-3">Qoldiq qiymati</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {sortedByMargin.map(p => {
                    const price    = Number(p.selling_price ?? 0)
                    const cost     = Number(p.cost_price ?? 0)
                    const margin   = price > 0 ? (p.profit / price) * 100 : 0
                    const stockVal = cost * p.stock_quantity
                    return (
                      <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-white font-medium">{p.title}</p>
                          <p className="text-slate-500 text-xs">{p.sku}</p>
                        </td>
                        <td className="px-4 py-3.5 text-right text-slate-300">{fmt(price)} so'm</td>
                        <td className="px-4 py-3.5 text-right text-slate-500">{cost > 0 ? `${fmt(cost)} so'm` : '—'}</td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={p.profit > 0 ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
                            {fmt(p.profit)} so'm
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`font-semibold ${margin >= 35 ? 'text-emerald-400' : margin >= 15 ? 'text-amber-400' : 'text-red-400'}`}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-slate-300">{p.stock_quantity}</td>
                        <td className="px-4 py-3.5 text-right text-slate-400">
                          {stockVal > 0 ? `${fmt(stockVal)} so'm` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-white/[0.03] border-t border-white/[0.08]">
                    <td colSpan={6} className="px-5 py-4 text-white font-bold text-xs uppercase tracking-wide">
                      Ombor qiymati jami
                    </td>
                    <td className="px-4 py-4 text-right text-violet-400 font-bold">{fmt(totalStockValue)} so'm</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
