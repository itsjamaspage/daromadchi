import { Package } from 'lucide-react'
import { getProducts } from '@/lib/db/products'
import ExportButton from '@/components/dashboard/ExportButton'

function formatSum(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

export default async function ProductsPage() {
  const products = await getProducts()

  const exportData = products.map(p => ({
    'Mahsulot': p.name,
    'SKU': p.sku,
    'Kategoriya': p.category,
    "Narx (so'm)": p.price,
    "Tannarx (so'm)": p.cost,
    "Foyda (so'm)": p.profit,
    'Margin (%)': ((p.profit / p.price) * 100).toFixed(1),
    'Sotilgan': p.sold ?? 0,
    'Ombor': p.stock,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mahsulotlar</h1>
          <p className="text-slate-400 text-sm mt-1">{products.length} ta mahsulot</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton data={exportData} filename="mahsulotlar" />
          <button className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
            <Package className="w-4 h-4" />
            Mahsulot qo&apos;shish
          </button>
        </div>
      </div>

      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-white/[0.05] bg-white/[0.01]">
                <th className="text-left font-medium px-5 py-3">Mahsulot</th>
                <th className="text-left font-medium px-5 py-3">Kategoriya</th>
                <th className="text-right font-medium px-5 py-3">Narx</th>
                <th className="text-right font-medium px-5 py-3">Tannarx</th>
                <th className="text-right font-medium px-5 py-3">Foyda</th>
                <th className="text-right font-medium px-5 py-3">Margin</th>
                <th className="text-right font-medium px-5 py-3">Sotilgan</th>
                <th className="text-right font-medium px-5 py-3">Ombor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {products.map(p => {
                const margin = Number(((p.profit / p.price) * 100).toFixed(1))
                const stockLow = p.stock < 20
                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-4">
                      <p className="text-white font-medium group-hover:text-violet-300 transition-colors">{p.name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{p.sku}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-slate-400 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06]">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-slate-300">{formatSum(p.price)}</td>
                    <td className="px-5 py-4 text-right text-slate-500">{formatSum(p.cost)}</td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-emerald-400 font-semibold">{formatSum(p.profit)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500"
                            style={{ width: `${Math.min(margin, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${margin > 35 ? 'text-emerald-400' : margin > 20 ? 'text-amber-400' : 'text-red-400'}`}>
                          {margin}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-slate-300">{p.sold ?? 0}</td>
                    <td className="px-5 py-4 text-right">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${
                        stockLow ? 'bg-red-500/10 text-red-400' : 'bg-slate-700/40 text-slate-300'
                      }`}>
                        {p.stock}
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
