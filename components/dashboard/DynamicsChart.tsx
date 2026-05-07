'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { dynamicsData } from '@/lib/mock-data'

type DataPoint = typeof dynamicsData[number]

const METRICS = [
  { key: 'revenue',     label: 'Daromad',           color: '#8b5cf6', format: (v: number) => (v/1_000_000).toFixed(1)+'M' },
  { key: 'profit',      label: 'Foyda',             color: '#22c55e', format: (v: number) => (v/1_000_000).toFixed(1)+'M' },
  { key: 'adSpend',     label: 'Reklama sarfi',      color: '#ef4444', format: (v: number) => (v/1_000_000).toFixed(1)+'M' },
  { key: 'drr',         label: 'DRR',               color: '#f59e0b', format: (v: number) => v.toFixed(1)+'%' },
  { key: 'clicks',      label: 'Kliklar',            color: '#06b6d4', format: (v: number) => v.toLocaleString('uz-UZ') },
  { key: 'impressions', label: "Ko'rsatuvlar",        color: '#6366f1', format: (v: number) => (v/1_000).toFixed(0)+'K'  },
  { key: 'avgCheck',    label: "O'rtacha chek",      color: '#a78bfa', format: (v: number) => (v/1_000).toFixed(0)+'K'  },
] as const

type MetricKey = typeof METRICS[number]['key']
const DEFAULT_ACTIVE: MetricKey[] = ['revenue', 'adSpend', 'drr']

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: {dataKey: string; value: number; color: string}[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0d0d1a] border border-white/[0.1] rounded-xl px-3 py-2.5 shadow-xl">
      <p className="text-xs text-slate-400 mb-2">{label}</p>
      {payload.map(entry => {
        const metric = METRICS.find(m => m.key === entry.dataKey)
        return (
          <p key={entry.dataKey} className="text-xs font-semibold" style={{ color: entry.color }}>
            {metric?.label}: {metric?.format(entry.value)}
          </p>
        )
      })}
    </div>
  )
}

interface Props {
  data: DataPoint[]
}

export default function DynamicsChart({ data }: Props) {
  const [active, setActive] = useState<Set<MetricKey>>(new Set(DEFAULT_ACTIVE))

  function toggle(key: MetricKey) {
    setActive(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  return (
    <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Dinamika grafigi</h3>
          <p className="text-slate-500 text-xs mt-0.5">Ko&apos;rsatgichlarni tanlang</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map(m => (
            <button key={m.key} onClick={() => toggle(m.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                active.has(m.key)
                  ? 'border-current opacity-100'
                  : 'border-transparent bg-white/[0.03] text-slate-600 opacity-50 hover:opacity-75'
              }`}
              style={active.has(m.key) ? { color: m.color, borderColor: m.color + '50', background: m.color + '15' } : {}}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} />
          {METRICS.filter(m => active.has(m.key)).map(m => (
            <Line key={m.key} type="monotone" dataKey={m.key}
              stroke={m.color} strokeWidth={2}
              dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
