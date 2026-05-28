'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

function fmtM(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-3 shadow-xl text-xs space-y-1.5 min-w-[160px]">
      <p className="text-slate-300 font-medium mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full" style={{ background: p.stroke }} />
            {p.name}
          </span>
          <span className="font-semibold text-white">{fmtM(p.value)} so'm</span>
        </div>
      ))}
    </div>
  )
}

export default function PnlChart({ data }: { data: { month: string; revenue: number; cost: number; adSpend: number; profit: number }[] }) {
  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6">
      <h3 className="text-white font-semibold mb-1">Daromad va foyda dinamikasi</h3>
      <p className="text-slate-500 text-xs mb-5">Oylik ko&apos;rsatkichlar</p>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtM} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 12 }} formatter={v => <span style={{ color: '#94a3b8' }}>{v}</span>} />
          <Area type="monotone" dataKey="revenue"  name="Daromad" stroke="#7c3aed" fill="url(#gRevenue)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="profit"   name="Sof foyda" stroke="#10b981" fill="url(#gProfit)"  strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
