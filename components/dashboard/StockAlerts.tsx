import { AlertTriangle, Package, TrendingDown } from 'lucide-react'
import type { Product } from '@/lib/types'

interface StockRow extends Product {
  daysLeft: number
  velocity: number
}

function computeAlerts(products: Product[]): StockRow[] {
  const PERIOD_DAYS = 30
  return products
    .map(p => {
      const velocity = (p.sold ?? 0) / PERIOD_DAYS
      const daysLeft = velocity > 0 ? Math.floor(p.stock_quantity / velocity) : 999
      return { ...p, daysLeft, velocity }
    })
    .filter(p => p.daysLeft <= 30 || p.stock_quantity < 15)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

export default function StockAlerts({ products }: { products: Product[] }) {
  const alerts = computeAlerts(products)
  if (alerts.length === 0) return null

  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h3 className="text-white font-semibold text-sm">Ombor ogohlantirishlari</h3>
        <span className="ml-auto text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
          {alerts.length} ta mahsulot
        </span>
      </div>

      <div className="divide-y divide-white/[0.03]">
        {alerts.map(p => {
          const urgent  = p.daysLeft <= 7
          const warning = p.daysLeft <= 14
          const reorder = Math.max(30, Math.ceil(p.velocity * 45))

          return (
            <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                urgent ? 'bg-red-500/10' : warning ? 'bg-amber-500/10' : 'bg-slate-700/30'
              }`}>
                {urgent
                  ? <TrendingDown className="w-4 h-4 text-red-400" />
                  : <Package className={`w-4 h-4 ${warning ? 'text-amber-400' : 'text-slate-400'}`} />
                }
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{p.title}</p>
                <p className="text-slate-500 text-xs">{p.sku} · {p.category}</p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold ${urgent ? 'text-red-400' : warning ? 'text-amber-400' : 'text-slate-300'}`}>
                  {p.stock_quantity} dona
                </p>
                <p className="text-slate-500 text-xs">
                  {p.daysLeft >= 999 ? 'Harakat yo\'q' : `~${p.daysLeft} kun qoldi`}
                </p>
              </div>

              <div className="text-right flex-shrink-0 hidden sm:block">
                <p className="text-xs text-slate-400 font-medium">Buyurtma berish</p>
                <p className="text-violet-400 text-sm font-bold">{reorder} dona</p>
              </div>

              <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${
                urgent ? 'bg-red-500' : warning ? 'bg-amber-500' : 'bg-slate-600'
              }`} />
            </div>
          )
        })}
      </div>

      <div className="px-5 py-3 border-t border-[var(--border)] bg-white/[0.01]">
        <p className="text-slate-500 text-xs">
          Hisoblash: so&apos;nggi 30 kunlik savdo tezligiga asoslangan · Buyurtma: 45 kunlik zaxira
        </p>
      </div>
    </div>
  )
}
