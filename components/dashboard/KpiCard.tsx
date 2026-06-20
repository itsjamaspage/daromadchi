import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string
  change?: number | null
  icon: LucideIcon
  color: 'violet' | 'emerald' | 'blue' | 'amber'
}

const colorMap = {
  violet:  { bgRgba: 'rgba(131,192,249,0.15)',  color: '#83c0f9' },
  emerald: { bgRgba: 'rgba(66,134,25,0.08)',   color: '#428619' },
  blue:    { bgRgba: 'rgba(55,108,213,0.08)',  color: '#376cd5' },
  amber:   { bgRgba: 'rgba(236,126,0,0.08)',   color: '#ec7e00' },
}

export default function KpiCard({ title, value, change, icon: Icon, color }: KpiCardProps) {
  const c = colorMap[color]
  const isPositive = (change ?? 0) >= 0

  return (
    <div
      className="rounded-[20px] p-5 transition-all"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: `2px solid ${c.color}` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.bgRgba }}>
          <Icon className="w-5 h-5" style={{ color: c.color }} />
        </div>
        {change != null && (
          <span
            title="vs prior period"
            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full cursor-default"
            style={{
              background: isPositive ? 'rgba(66,134,25,0.08)' : 'rgba(226,59,74,0.08)',
              color:      isPositive ? '#428619'              : '#e23b4a',
            }}
          >
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <p className="text-xs font-medium mb-1 tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {title}
      </p>
      <p className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-base)' }}>
        {value}
      </p>
    </div>
  )
}
