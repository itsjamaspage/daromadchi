'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { useTheme } from '@/app/providers'

interface Row { name: string; drrTotal: number; drrAd: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="border rounded-xl px-4 py-3 shadow-xl text-xs space-y-1.5" style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)' }}>
      <p className="font-medium truncate max-w-[160px]" style={{ color: 'var(--text-dim)' }}>{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
          <span style={{ color: 'var(--text-muted)' }}>{p.name}:</span>
          <span className="font-semibold" style={{ color: 'var(--text-base)' }}>{p.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

export default function AdDrrChart({ rows }: { rows: Row[] }) {
  const { theme } = useTheme()
  const axisColor = theme === 'dark' ? '#64748b' : '#9ca3af'
  const gridColor = theme === 'dark' ? '#ffffff08' : '#f3f4f6'
  const cursorColor = theme === 'dark' ? '#ffffff04' : '#f0f0f0'
  const legendColor = theme === 'dark' ? '#94a3b8' : '#9ca3af'

  const data = rows.map(r => ({
    name: r.name.split(' ').slice(0, 2).join(' '),
    'DRR umumiy': parseFloat(r.drrTotal.toFixed(1)),
    'DRR reklama': parseFloat(r.drrAd.toFixed(1)),
  }))

  return (
    <div className="border rounded-2xl p-6" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--text-base)' }}>DRR taqqoslash</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Mahsulot bo&apos;yicha reklama xarajatlari ulushi</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={2} barCategoryGap="30%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => `${v}%`} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={38} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: cursorColor }} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: legendColor, paddingTop: 12 }}
            formatter={(value) => <span style={{ color: legendColor }}>{value}</span>}
          />
          <ReferenceLine y={25} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: 'Max 25%', fill: '#f59e0b', fontSize: 10, position: 'right' }} />
          <Bar dataKey="DRR umumiy"  fill="#7c3aed" radius={[4, 4, 0, 0]} />
          <Bar dataKey="DRR reklama" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
