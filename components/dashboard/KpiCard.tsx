import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string
  change?: number | null
  icon: LucideIcon
  color: 'violet' | 'emerald' | 'blue' | 'amber'
}

const colorMap = {
  violet: { bg: 'bg-violet-500/10', icon: 'text-violet-400', border: 'border-violet-500/10' },
  emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', border: 'border-emerald-500/10' },
  blue: { bg: 'bg-blue-500/10', icon: 'text-blue-400', border: 'border-blue-500/10' },
  amber: { bg: 'bg-amber-500/10', icon: 'text-amber-400', border: 'border-amber-500/10' },
}

export default function KpiCard({ title, value, change, icon: Icon, color }: KpiCardProps) {
  const c = colorMap[color]
  const isPositive = (change ?? 0) >= 0

  return (
    <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.1] transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        {change != null && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${
            isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-slate-400 text-xs font-medium mb-1">{title}</p>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      </div>
    </div>
  )
}
