'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import type { DailyRevenue } from '@/lib/types'

function formatSum(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return `${value}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#1c1c2e] border border-white/[0.08] rounded-xl px-4 py-3 shadow-xl">
        <p className="text-slate-400 text-xs mb-1">{label}</p>
        <p className="text-white font-bold text-sm">
          {payload[0].value.toLocaleString('uz-UZ')} so&apos;m
        </p>
      </div>
    )
  }
  return null
}

export default function RevenueChart({ data }: { data: DailyRevenue[] }) {
  return (
    <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white font-semibold">Kunlik daromad</h3>
          <p className="text-slate-500 text-xs mt-0.5">So&apos;nggi 7 kun</p>
        </div>
        <span className="text-xs text-slate-500 bg-white/[0.04] px-3 py-1.5 rounded-lg border border-white/[0.06]">
          So&apos;m
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barSize={32} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatSum}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff05' }} />
          <Bar dataKey="revenue" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.7} />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
