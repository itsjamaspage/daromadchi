'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useTheme } from '@/app/providers'

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

function MiniPanel({
  data, dataKey, color, label, total, isDark, unit,
}: {
  data: DataRow[]
  dataKey: keyof DataRow
  color: string
  label: string
  total: number
  isDark: boolean
  unit?: string
}) {
  const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'
  const tickColor = isDark ? '#475569' : '#94a3b8'

  const first = (data[0]?.[dataKey] as number) ?? 0
  const last = (data[data.length - 1]?.[dataKey] as number) ?? 0
  const trend = first > 0 ? ((last - first) / first) * 100 : null
  const trendUp = trend !== null && trend >= 0

  return (
    <div
      className="border rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
        {trend !== null && (
          <span
            className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
              trendUp ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
            }`}
          >
            {trendUp
              ? <TrendingUp className="w-2.5 h-2.5" />
              : <TrendingDown className="w-2.5 h-2.5" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>

      <div>
        <p className="text-2xl font-bold leading-none" style={{ color }}>
          {fmtM(total)}
        </p>
        {unit && (
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{unit}</p>
        )}
      </div>

      <ResponsiveContainer width="100%" height={88}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: tickColor, fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontSize: 11,
              padding: '6px 10px',
            }}
            labelStyle={{ color: 'var(--text-muted)', marginBottom: 2 }}
            itemStyle={{ color }}
            formatter={(v: number) => [
              unit ? `${fmtFull(v)} ${unit}` : fmtFull(v),
              label,
            ]}
          />
          <Line
            type="monotone"
            dataKey={dataKey as string}
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

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
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0)
  const totalCost    = data.reduce((s, d) => s + d.cost, 0)
  const totalProfit  = data.reduce((s, d) => s + d.profit, 0)
  const totalOrders  = data.reduce((s, d) => s + (d.orders ?? 0), 0)
  const showOrders   = ordersLabel && data.some(d => (d.orders ?? 0) > 0)

  const cols = showOrders ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'

  return (
    <div className={`grid gap-4 ${cols}`}>
      <MiniPanel data={data} dataKey="revenue" color="#83c0f9" label={revenueLabel} total={totalRevenue} isDark={isDark} unit="so'm" />
      <MiniPanel data={data} dataKey="cost"    color="#f87171" label={costLabel}    total={totalCost}    isDark={isDark} unit="so'm" />
      <MiniPanel data={data} dataKey="profit"  color="#10b981" label={profitLabel}  total={totalProfit}  isDark={isDark} unit="so'm" />
      {showOrders && ordersLabel && (
        <MiniPanel data={data} dataKey="orders" color="#f59e0b" label={ordersLabel} total={totalOrders} isDark={isDark} />
      )}
    </div>
  )
}
