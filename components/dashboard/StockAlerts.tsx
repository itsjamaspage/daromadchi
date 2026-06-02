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
      const velocity = p.sold / PERIOD_DAYS
      const daysLeft = velocity > 0 ? Math.floor(p.available_stock / velocity) : 999
      return { ...p, daysLeft, velocity }
    })
    .filter(p => p.daysLeft <= 30 || p.available_stock < 15)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

export default function StockAlerts({ products }: { products: Product[] }) {
  const alerts = computeAlerts(products)
  if (alerts.length === 0) return null

  return (
    <div className="border rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
      <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <AlertTriangle className="w-4 h-4" style={{ color: '#f59e0b' }} />
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>Ombor ogohlantirishlari</h3>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-lg border" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
          {alerts.length} ta mahsulot
        </span>
      </div>

      <div style={{ borderColor: 'var(--border)' }}>
        {alerts.map((p, idx) => {
          const urgent  = p.daysLeft <= 7
          const warning = p.daysLeft <= 14
          const reorder = Math.max(30, Math.ceil(p.velocity * 45))
          const urgentColor = urgent ? '#ef4444' : warning ? '#f59e0b' : 'var(--text-muted)'
          const bgColor = urgent ? 'rgba(239, 68, 68, 0.1)' : warning ? 'rgba(245, 158, 11, 0.1)' : 'rgba(100, 116, 139, 0.1)'
          const barColor = urgent ? '#ef4444' : warning ? '#f59e0b' : '#64748b'

          return (
            <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors" style={{ borderBottom: idx < alerts.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bgColor, color: urgentColor }}>
                {urgent
                  ? <TrendingDown className="w-4 h-4" />
                  : <Package className="w-4 h-4" />
                }
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-base)' }}>{p.title}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.sku} · {p.category}</p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold" style={{ color: urgentColor }}>
                  {p.available_stock} dona
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {p.daysLeft >= 999 ? 'Harakat yo\'q' : `~${p.daysLeft} kun qoldi`}
                </p>
              </div>

              <div className="text-right flex-shrink-0 hidden sm:block">
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Buyurtma berish</p>
                <p className="text-sm font-bold" style={{ color: '#7c3aed' }}>{reorder} dona</p>
              </div>

              <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ background: barColor }} />
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
