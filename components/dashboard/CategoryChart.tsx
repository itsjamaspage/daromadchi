'use client'

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const { name, value, payload: p } = payload[0]
  return (
    <div className="bg-[#1c1c2e] border border-white/[0.08] rounded-xl px-4 py-3 shadow-xl text-xs space-y-1">
      <p className="text-slate-300 font-medium">{name}</p>
      <p className="text-white font-bold">{new Intl.NumberFormat('uz-UZ').format(value)} so&apos;m</p>
      <p className="text-slate-400">{p.percent?.toFixed(1)}% ulush</p>
    </div>
  )
}

interface CategoryData { name: string; revenue: number; profit: number; percent: number }

export default function CategoryChart({ data }: { data: CategoryData[] }) {
  return (
    <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-6">
      <h3 className="text-white font-semibold mb-0.5">Kategoriya bo&apos;yicha daromad</h3>
      <p className="text-slate-500 text-xs mb-5">Savdo ulushi</p>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={3}
              dataKey="revenue"
              nameKey="name"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex-1 space-y-2 w-full">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-300 text-xs truncate">{d.name}</span>
                  <span className="text-slate-500 text-xs ml-2">{d.percent.toFixed(0)}%</span>
                </div>
                <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${d.percent}%`, background: COLORS[i % COLORS.length] }}
                  />
                </div>
              </div>
              <span className="text-slate-400 text-xs flex-shrink-0 hidden sm:block">
                {new Intl.NumberFormat('uz-UZ').format(Math.round(d.revenue / 1_000_000))}M
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
