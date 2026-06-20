'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useTheme } from '@/app/providers'

function fmtM(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="border rounded-xl px-4 py-3 shadow-xl text-xs space-y-1.5 min-w-[160px]"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <p className="font-medium mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: p.stroke }} />
            {p.name}
          </span>
          <span className="font-semibold" style={{ color: 'var(--text-base)' }}>{fmtM(p.value)} so'm</span>
        </div>
      ))}
    </div>
  )
}

export default function PnlChart({ data, title, subtitle, revenueLabel, profitLabel }: {
  data: { month: string; revenue: number; cost: number; adSpend: number; profit: number }[]
  title: string; subtitle: string; revenueLabel: string; profitLabel: string
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const tickColor = isDark ? '#64748b' : '#94a3b8'
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="border rounded-2xl p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <h3 className="font-semibold mb-1" style={{ color: 'var(--text-base)' }}>{title}</h3>
      <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#83c0f9" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#83c0f9" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtM} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} formatter={v => <span style={{ color: 'var(--text-muted)' }}>{v}</span>} />
          <Area type="monotone" dataKey="revenue" name={revenueLabel} stroke="#83c0f9" fill="url(#gRevenue)" strokeWidth={2.5} dot={false} />
          <Area type="monotone" dataKey="profit"  name={profitLabel}  stroke="#10b981" fill="url(#gProfit)"  strokeWidth={2.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
