'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import type { DailyRevenue } from '@/lib/types'
import { useLang, useTheme } from '@/app/providers'
import { dashT } from '@/lib/dashT'

function formatSum(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return `${value}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="border rounded-xl px-4 py-3 shadow-xl" style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)' }}>
        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="font-bold text-sm" style={{ color: 'var(--text-base)' }}>
          {payload[0].value.toLocaleString('uz-UZ')} so&apos;m
        </p>
      </div>
    )
  }
  return null
}

export default function RevenueChart({ data, days = 7 }: { data: DailyRevenue[]; days?: number }) {
  const { lang } = useLang()
  const { theme } = useTheme()
  const d = dashT[lang].dashboard
  const axisColor = theme === 'dark' ? '#64748b' : '#9ca3af'
  const gridColor = theme === 'dark' ? '#ffffff08' : '#f3f4f6'
  const cursorColor = theme === 'dark' ? '#ffffff05' : '#f0f0f0'
  const barColor1 = theme === 'dark' ? '#7c3aed' : '#7c3aed'
  const barColor2 = theme === 'dark' ? '#4f46e5' : '#a78bfa'

  return (
    <div className="border rounded-2xl p-6" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--text-base)' }}>{d.dailyRevenue}</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{d.last} {days} {d.daysSuffix}</p>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-lg border" style={{ color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.04)', borderColor: 'var(--border)' }}>
          So&apos;m
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barSize={32} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: axisColor, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatSum}
            tick={{ fill: axisColor, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: cursorColor }} />
          <Bar dataKey="revenue" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={barColor1} />
              <stop offset="100%" stopColor={barColor2} stopOpacity={0.7} />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
