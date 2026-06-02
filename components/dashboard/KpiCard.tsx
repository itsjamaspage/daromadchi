import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string
  change?: number | null
  icon: LucideIcon
  color: 'violet' | 'emerald' | 'blue' | 'amber'
}

const colorMap = {
  violet: { bgRgba: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', lightColor: '#a78bfa' },
  emerald: { bgRgba: 'rgba(52, 211, 153, 0.1)', color: '#10b981', lightColor: '#6ee7b7' },
  blue: { bgRgba: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', lightColor: '#60a5fa' },
  amber: { bgRgba: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', lightColor: '#fcd34d' },
}

export default function KpiCard({ title, value, change, icon: Icon, color }: KpiCardProps) {
  const c = colorMap[color]
  const isPositive = (change ?? 0) >= 0

  return (
    <div className="rounded-2xl p-5 transition-all" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.bgRgba, border: `1px solid ${c.bgRgba}` }}>
          <Icon className="w-5 h-5" style={{ color: c.color }} />
        </div>
        {change != null && (
          <span
            title="vs prior period"
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg cursor-default"
            style={{
              background: isPositive ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: isPositive ? '#10b981' : '#ef4444',
            }}
          >
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{title}</p>
        <p className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-base)' }}>{value}</p>
      </div>
    </div>
  )
}
