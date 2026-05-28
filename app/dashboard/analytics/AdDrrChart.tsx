'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'

interface Row { name: string; drrTotal: number; drrAd: number }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-3 shadow-xl text-xs space-y-1.5">
      <p className="text-slate-300 font-medium truncate max-w-[160px]">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-semibold">{p.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

export default function AdDrrChart({ rows }: { rows: Row[] }) {
  const data = rows.map(r => ({
    name: r.name.split(' ').slice(0, 2).join(' '),
    'DRR umumiy': parseFloat(r.drrTotal.toFixed(1)),
    'DRR reklama': parseFloat(r.drrAd.toFixed(1)),
  }))

  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-white font-semibold">DRR taqqoslash</h3>
          <p className="text-slate-500 text-xs mt-0.5">Mahsulot bo&apos;yicha reklama xarajatlari ulushi</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={2} barCategoryGap="30%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => `${v}%`} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={38} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff04' }} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 12 }}
            formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
          />
          <ReferenceLine y={25} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: 'Max 25%', fill: '#f59e0b', fontSize: 10, position: 'right' }} />
          <Bar dataKey="DRR umumiy"  fill="#7c3aed" radius={[4, 4, 0, 0]} />
          <Bar dataKey="DRR reklama" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
