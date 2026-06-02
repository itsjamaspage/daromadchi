'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { dynamicsData } from '@/lib/mock-data'
import { useLang, useTheme } from '@/app/providers'
import { translations } from '@/lib/i18n'

type DataPoint = typeof dynamicsData[number]

type MetricKey = 'revenue' | 'profit' | 'adSpend' | 'drr' | 'clicks' | 'impressions' | 'avgCheck'
const DEFAULT_ACTIVE: MetricKey[] = ['revenue', 'adSpend', 'drr']

function getMetrics(lang: string) {
  const t = translations[lang].dashboard
  return [
    { key: 'revenue' as MetricKey,     label: t?.dynamicsRevenue || 'Daromad',           color: '#8b5cf6', format: (v: number) => (v/1_000_000).toFixed(1)+'M' },
    { key: 'profit' as MetricKey,      label: t?.dynamicsProfit || 'Foyda',             color: '#22c55e', format: (v: number) => (v/1_000_000).toFixed(1)+'M' },
    { key: 'adSpend' as MetricKey,     label: t?.dynamicsAdSpend || 'Reklama sarfi',      color: '#ef4444', format: (v: number) => (v/1_000_000).toFixed(1)+'M' },
    { key: 'drr' as MetricKey,         label: t?.dynamicsDrr || 'DRR',               color: '#f59e0b', format: (v: number) => v.toFixed(1)+'%' },
    { key: 'clicks' as MetricKey,      label: t?.dynamicsClicks || 'Kliklar',            color: '#06b6d4', format: (v: number) => v.toLocaleString('uz-UZ') },
    { key: 'impressions' as MetricKey, label: t?.dynamicsImpressions || "Ko'rsatuvlar",        color: '#6366f1', format: (v: number) => (v/1_000).toFixed(0)+'K'  },
    { key: 'avgCheck' as MetricKey,    label: t?.dynamicsAvgCheck || "O'rtacha chek",      color: '#a78bfa', format: (v: number) => (v/1_000).toFixed(0)+'K'  },
  ] as const
}

function CustomTooltip({ active, payload, label, metrics }: { active?: boolean; payload?: {dataKey: string; value: number; color: string}[]; label?: string; metrics: ReturnType<typeof getMetrics> }) {
  if (!active || !payload?.length) return null
  return (
    <div className="border rounded-xl px-3 py-2.5 shadow-xl" style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)' }}>
      <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {payload.map(entry => {
        const metric = metrics.find(m => m.key === entry.dataKey)
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
  const { lang } = useLang()
  const { theme } = useTheme()
  const metrics = getMetrics(lang)
  const [active, setActive] = useState<Set<MetricKey>>(new Set(DEFAULT_ACTIVE))
  const axisColor = theme === 'dark' ? '#64748b' : '#9ca3af'
  const gridColor = theme === 'dark' ? '#ffffff08' : '#f3f4f6'

  function toggle(key: MetricKey) {
    setActive(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  return (
    <div className="border rounded-2xl p-5" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>{translations[lang].dashboard?.dynamicsTitle || 'Dinamika grafigi'}</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{translations[lang].dashboard?.dynamicsSelect || "Ko'rsatgichlarni tanlang"}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {metrics.map(m => (
            <button key={m.key} onClick={() => toggle(m.key)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all"
              style={active.has(m.key) ? { color: m.color, borderColor: m.color + '50', background: m.color + '15' } : {
                color: 'var(--text-muted)',
                borderColor: 'transparent',
                background: 'rgba(255, 255, 255, 0.03)',
                opacity: '0.5',
              }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip content={<CustomTooltip metrics={metrics} />} />
          {metrics.filter(m => active.has(m.key)).map(m => (
            <Line key={m.key} type="monotone" dataKey={m.key}
              stroke={m.color} strokeWidth={2}
              dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
