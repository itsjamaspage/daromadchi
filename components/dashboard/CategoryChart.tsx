'use client'

import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  const { lang } = useLang()
  const t = translations[lang].dashboard
  if (!active || !payload?.length) return null
  const { name, value, payload: p } = payload[0]
  return (
    <div className="border rounded-xl px-4 py-3 shadow-xl text-xs space-y-1" style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)' }}>
      <p className="font-medium" style={{ color: 'var(--text-dim)' }}>{name}</p>
      <p className="font-bold" style={{ color: 'var(--text-base)' }}>{new Intl.NumberFormat('uz-UZ').format(value)} so&apos;m</p>
      <p style={{ color: 'var(--text-muted)' }}>{p.percent?.toFixed(1)}% {t?.categoryShare || 'ulush'}</p>
    </div>
  )
}

interface CategoryData { name: string; revenue: number; profit: number; percent: number }

export default function CategoryChart({ data }: { data: CategoryData[] }) {
  const { lang } = useLang()
  const t = translations[lang].dashboard
  return (
    <div className="border rounded-2xl p-6" style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
      <h3 className="font-semibold mb-0.5" style={{ color: 'var(--text-base)' }}>{t?.categoryRevenue || 'Kategoriya bo\'yicha daromad'}</h3>
      <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>{t?.tradeShare || 'Savdo ulushi'}</p>

      {data.length === 0 ? (
        <div className="flex items-center gap-3 py-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(131,192,249,0.08)', border: '1px solid rgba(131,192,249,0.15)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t?.noData ?? 'No category data'}</p>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          {/* Fixed-size PieChart — avoids the height expansion that ResponsiveContainer caused */}
          <div className="flex-shrink-0">
            <PieChart width={152} height={152}>
              <Pie
                data={data}
                cx={76}
                cy={76}
                innerRadius={46}
                outerRadius={68}
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
          </div>

          <div className="flex-1 space-y-2.5 min-w-0">
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>{d.name}</span>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{d.percent.toFixed(0)}%</span>
                      <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--text-dim)' }}>
                        {new Intl.NumberFormat('uz-UZ').format(Math.round(d.revenue / 1_000_000))}M
                      </span>
                    </div>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${d.percent}%`, background: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
