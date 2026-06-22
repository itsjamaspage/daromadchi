'use client'

import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
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

function Sparkline({ data, dataKey, color, label }: {
  data: DataRow[]
  dataKey: keyof DataRow
  color: string
  label: string
}) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <Tooltip
          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, padding: '4px 8px' }}
          labelStyle={{ color: 'var(--text-muted)', marginBottom: 2 }}
          itemStyle={{ color }}
          formatter={(v: number) => [fmtFull(v), label]}
        />
        <Line type="monotone" dataKey={dataKey as string} stroke={color} strokeWidth={2}
          dot={false} activeDot={{ r: 4, fill: color, strokeWidth: 0 }} />
      </LineChart>
    </ResponsiveContainer>
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

  function trend(key: keyof DataRow) {
    const first = (data[0]?.[key] as number) ?? 0
    const last  = (data[data.length - 1]?.[key] as number) ?? 0
    return first > 0 ? ((last - first) / first) * 100 : null
  }

  const rows = [
    { label: revenueLabel, key: 'revenue' as const, color: '#0284c7', total: totalRevenue, unit: "so'm" },
    { label: costLabel,    key: 'cost'    as const, color: '#dc2626', total: totalCost,    unit: "so'm" },
    { label: profitLabel,  key: 'profit'  as const, color: '#059669', total: totalProfit,  unit: "so'm" },
    ...(showOrders && ordersLabel ? [{ label: ordersLabel, key: 'orders' as const, color: '#d97706', total: totalOrders, unit: '' }] : []),
  ]

  return (
    <div className="border rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <table className="w-full">
        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {rows.map((row, i) => {
            const t = trend(row.key)
            const up = t !== null && t >= 0
            return (
              <tr key={row.key} className={i % 2 === 1 ? '' : ''}>
                {/* Label */}
                <td className="px-5 py-4 w-32">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                  </div>
                </td>

                {/* Value */}
                <td className="px-5 py-4 w-40">
                  <p className="text-lg font-bold leading-none" style={{ color: row.color }}>
                    {fmtM(row.total)}
                  </p>
                  {row.unit && (
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{row.unit}</p>
                  )}
                </td>

                {/* Trend badge */}
                <td className="px-4 py-4 w-24">
                  {t !== null && (
                    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-lg ${
                      up ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100'
                    }`}>
                      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {up ? '+' : ''}{Math.abs(t).toFixed(1)}%
                    </span>
                  )}
                </td>

                {/* Sparkline */}
                <td className="pr-5 py-2" style={{ minWidth: 140 }}>
                  <Sparkline data={data} dataKey={row.key} color={row.color} label={row.label} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
