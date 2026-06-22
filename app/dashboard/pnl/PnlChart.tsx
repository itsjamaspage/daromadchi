'use client'

import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'

function fmtM(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(Math.round(v))
}

function fmtFull(v: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(v))
}

type DataRow = {
  month: string
  revenue: number
  cost: number
  profit: number
  orders?: number
}

type MetricKey = 'revenue' | 'cost' | 'profit' | 'orders'

export default function PnlChart({
  data,
  revenueLabel,
  costLabel,
  profitLabel,
  ordersLabel,
}: {
  data: DataRow[]
  revenueLabel: string
  costLabel: string
  profitLabel: string
  ordersLabel?: string
}) {
  const showOrders = !!ordersLabel && data.some(d => (d.orders ?? 0) > 0)

  const metrics: { key: MetricKey; label: string; color: string; unit: string }[] = [
    { key: 'revenue', label: revenueLabel, color: '#0284c7', unit: "so'm" },
    { key: 'cost',    label: costLabel,    color: '#dc2626', unit: "so'm" },
    { key: 'profit',  label: profitLabel,  color: '#059669', unit: "so'm" },
    ...(showOrders && ordersLabel ? [{ key: 'orders' as MetricKey, label: ordersLabel, color: '#d97706', unit: '' }] : []),
  ]

  const [active, setActive] = useState<MetricKey>('revenue')

  const metric = metrics.find(m => m.key === active) ?? metrics[0]
  const total  = data.reduce((s, d) => s + ((d[active] as number) ?? 0), 0)

  const first = (data[0]?.[active] as number) ?? 0
  const last  = (data[data.length - 1]?.[active] as number) ?? 0
  const trend = first > 0 ? ((last - first) / first) * 100 : null
  const up    = trend !== null && trend >= 0

  return (
    <div className="border rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

      {/* Metric selector tabs — click to switch */}
      <div className={`grid border-b divide-x ${showOrders ? 'grid-cols-4' : 'grid-cols-3'}`}
        style={{ borderColor: 'var(--border)', '--tw-divide-opacity': 1 } as React.CSSProperties}>
        {metrics.map(m => {
          const isActive = m.key === active
          const mTotal = data.reduce((s, d) => s + ((d[m.key] as number) ?? 0), 0)
          return (
            <button
              key={m.key}
              onClick={() => setActive(m.key)}
              className="flex flex-col items-start px-5 py-4 text-left transition-all hover:opacity-90 border-[var(--border)]"
              style={{
                background: isActive ? `color-mix(in srgb, ${m.color} 8%, transparent)` : 'transparent',
                borderBottom: `3px solid ${isActive ? m.color : 'transparent'}`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{m.label}</span>
              </div>
              <p className="text-lg font-bold leading-none" style={{ color: m.color }}>{fmtM(mTotal)}</p>
              {m.unit && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{m.unit}</p>}
            </button>
          )
        })}
      </div>

      {/* Detail area for selected metric */}
      <div className="p-5 space-y-4">

        {/* Headline */}
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[11px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>{metric.label}</p>
            <p className="text-3xl font-bold leading-none" style={{ color: metric.color }}>{fmtM(total)}</p>
            {metric.unit && <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{metric.unit}</p>}
          </div>
          {trend !== null && (
            <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg ml-auto ${
              up ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100'
            }`}>
              {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {up ? '+' : ''}{Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>

        {/* Area chart */}
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${active}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={metric.color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={metric.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
              tickFormatter={v => fmtM(v as number)} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, padding: '4px 8px' }}
              labelStyle={{ color: 'var(--text-muted)', marginBottom: 2 }}
              formatter={(v: number) => [`${fmtFull(v)}${metric.unit ? ` ${metric.unit}` : ''}`, metric.label]}
            />
            <Area type="monotone" dataKey={active} stroke={metric.color} strokeWidth={2}
              fill={`url(#grad-${active})`} dot={false} activeDot={{ r: 4, fill: metric.color, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>

        {/* Month-by-month breakdown */}
        <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {data.map(row => {
              const val = (row[active] as number) ?? 0
              return (
                <div key={row.month} className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.month}</span>
                  <span className="text-xs font-semibold" style={{ color: metric.color }}>
                    {fmtM(val)}{metric.unit ? ` ${metric.unit}` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
