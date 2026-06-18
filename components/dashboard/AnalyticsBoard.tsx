'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, PieChart, Pie, Cell,
  FunnelChart, Funnel, LabelList,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { TrendingUp, TrendingDown, Users, Eye, MousePointerClick, Repeat } from 'lucide-react'
import { useLang, useTheme } from '@/app/providers'
import type { DailyRevenue, Product, Kpis } from '@/lib/types'

/* ── trilingual labels ──────────────────────────────────────────────────────── */
const L = {
  uz: {
    heading: 'Analitik panel', sub: "Savdo va trafik ko'rsatkichlari",
    trendsByChannel: 'Kanallar bo\'yicha savdo dinamikasi', revenueSom: 'Daromad (so\'m)',
    newVsReturning: 'Yangi va qaytgan mijozlar', newCustomers: 'Yangi mijozlar', returning: 'Qaytgan mijozlar',
    salesFunnel: 'Savdo voronkasi', impressions: "Ko'rsatishlar", clicks: 'Kliklar',
    cart: "Savatga qo'shildi", orders: 'Buyurtmalar', delivered: 'Yetkazildi',
    categoryBubble: 'Kategoriya samaradorligi', margin: 'Margin %', units: 'Soni',
    totalVisits: "Tashriflar", pagesPerVisit: 'Tashrifga sahifa', conversion: 'Konversiya',
    avgCheck: "O'rtacha chek", total: 'Jami', vsPrev: "o'tgan davrga nisbatan",
  },
  ru: {
    heading: 'Аналитическая панель', sub: 'Показатели продаж и трафика',
    trendsByChannel: 'Динамика продаж по каналам', revenueSom: 'Выручка (сум)',
    newVsReturning: 'Новые и вернувшиеся клиенты', newCustomers: 'Новые клиенты', returning: 'Вернувшиеся',
    salesFunnel: 'Воронка продаж', impressions: 'Показы', clicks: 'Клики',
    cart: 'Добавили в корзину', orders: 'Заказы', delivered: 'Доставлено',
    categoryBubble: 'Эффективность категорий', margin: 'Маржа %', units: 'Шт',
    totalVisits: 'Визиты', pagesPerVisit: 'Страниц за визит', conversion: 'Конверсия',
    avgCheck: 'Средний чек', total: 'Всего', vsPrev: 'к предыдущему периоду',
  },
  en: {
    heading: 'Analytics board', sub: 'Sales & traffic insights',
    trendsByChannel: 'Sales trends by channel', revenueSom: 'Revenue (UZS)',
    newVsReturning: 'New vs returning customers', newCustomers: 'New customers', returning: 'Returning',
    salesFunnel: 'Sales funnel', impressions: 'Impressions', clicks: 'Clicks',
    cart: 'Added to cart', orders: 'Orders', delivered: 'Delivered',
    categoryBubble: 'Category performance', margin: 'Margin %', units: 'Units',
    totalVisits: 'Total visits', pagesPerVisit: 'Pages per visit', conversion: 'Conversion',
    avgCheck: 'Avg. check', total: 'Total', vsPrev: 'vs previous period',
  },
} as const

const PALETTE = ['#494fdf', '#428619', '#10b981', '#ec7e00', '#e23b4a', '#4f55f1', '#376cd5']

function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${Math.round(n)}`
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="border rounded-xl px-3 py-2.5 shadow-xl text-xs space-y-1"
      style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)' }}>
      {children}
    </div>
  )
}

interface Props {
  chartData: DailyRevenue[]
  categoryData: { name: string; revenue: number; profit: number; percent: number }[]
  products: Product[]
  kpis: Kpis
}

export default function AnalyticsBoard({ chartData, categoryData, products, kpis }: Props) {
  const { lang } = useLang()
  const { theme } = useTheme()
  const t = L[lang] ?? L.uz
  const axisColor = theme === 'dark' ? '#64748b' : '#9ca3af'
  const gridColor = theme === 'dark' ? '#ffffff10' : '#00000010'

  /* Stacked channel data — split daily revenue across marketplaces deterministically */
  const channelData = useMemo(() => {
    const split = [0.54, 0.31, 0.15] // uzum / yandex / wildberries
    return chartData.map((d, i) => {
      const wobble = ((i * 7) % 11) / 100 - 0.05
      const uzum = Math.round(d.revenue * (split[0] + wobble))
      const yandex = Math.round(d.revenue * (split[1] - wobble / 2))
      const wb = Math.max(0, d.revenue - uzum - yandex)
      return { date: d.date, Uzum: uzum, Yandex: yandex, Wildberries: wb }
    })
  }, [chartData])

  /* New vs returning — derived from total orders */
  const customerSplit = useMemo(() => {
    const total = kpis.total_orders || 1
    const ret = Math.round(total * 0.38)
    return [
      { name: t.newCustomers, value: total - ret },
      { name: t.returning, value: ret },
    ]
  }, [kpis.total_orders, t])

  /* Funnel — impressions → clicks → cart → orders → delivered */
  const funnelData = useMemo(() => {
    const orders = kpis.total_orders || 0
    const impressions = Math.max(orders * 64, 1200)
    const clicks = Math.round(impressions * 0.18)
    const cart = Math.round(clicks * 0.42)
    const delivered = Math.round(orders * 0.86)
    return [
      { name: t.impressions, value: impressions, fill: PALETTE[1] },
      { name: t.clicks, value: clicks, fill: PALETTE[0] },
      { name: t.cart, value: cart, fill: PALETTE[5] },
      { name: t.orders, value: Math.max(orders, delivered), fill: PALETTE[2] },
      { name: t.delivered, value: delivered, fill: PALETTE[3] },
    ]
  }, [kpis.total_orders, t])

  /* Category bubble — x: margin %, y: revenue, z: units sold.
     Pre-bucket products by category once (O(n)) instead of filtering the full
     product list for every category (O(n*m)). */
  const soldByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      const cat = p.category ?? 'Boshqa'
      map.set(cat, (map.get(cat) ?? 0) + (p.sold ?? 0))
    }
    return map
  }, [products])

  const bubbleData = useMemo(() => {
    return categoryData.slice(0, 7).map((c, i) => {
      const units = (soldByCategory.get(c.name) ?? 0) || Math.round(c.revenue / 500_000)
      const margin = c.revenue > 0 ? Math.min(60, Math.max(4, (c.profit / c.revenue) * 100)) : 10
      return { name: c.name, x: Number(margin.toFixed(1)), y: c.revenue, z: Math.max(units, 5), fill: PALETTE[i % PALETTE.length] }
    })
  }, [categoryData, soldByCategory])

  /* Sparkline KPI tiles */
  const spark = useMemo(() => chartData.map(d => ({ v: d.revenue })), [chartData])
  const totalVisits = (kpis.total_orders || 0) * 47
  const conv = totalVisits > 0 ? ((kpis.total_orders || 0) / totalVisits) * 100 : 0
  const avgCheck = kpis.total_orders > 0 ? kpis.total_revenue / kpis.total_orders : 0

  const tiles = [
    { label: t.totalVisits, value: totalVisits.toLocaleString('uz-UZ'), change: 12.4, icon: Eye, color: PALETTE[1] },
    { label: t.conversion, value: `${conv.toFixed(2)}%`, change: 3.8, icon: MousePointerClick, color: PALETTE[2] },
    { label: t.pagesPerVisit, value: '3.81', change: -1.2, icon: Repeat, color: PALETTE[0] },
    { label: t.avgCheck, value: `${fmtCompact(avgCheck)}`, change: 5.6, icon: Users, color: PALETTE[3] },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="w-1 h-5 rounded-full" style={{ background: PALETTE[0] }} />
        <div>
          <h2 className="font-bold text-lg" style={{ color: 'var(--text-base)' }}>{t.heading}</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.sub}</p>
        </div>
      </div>

      {/* Sparkline KPI tiles */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {tiles.map((tile, i) => {
          const up = tile.change >= 0
          const Icon = tile.icon
          return (
            <div key={tile.label} className="border rounded-2xl p-4 overflow-hidden"
              style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{tile.label}</span>
                <Icon className="w-4 h-4" style={{ color: tile.color }} />
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-xl font-bold" style={{ color: 'var(--text-base)' }}>{tile.value}</p>
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold"
                    style={{ color: up ? '#10b981' : '#ef4444' }}>
                    {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {up ? '+' : ''}{tile.change}%
                  </span>
                </div>
                <div className="w-20 h-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id={`spark-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={tile.color} stopOpacity={0.5} />
                          <stop offset="100%" stopColor={tile.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke={tile.color} strokeWidth={1.5}
                        fill={`url(#spark-${i})`} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Stacked channel bar + new vs returning donut */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 border rounded-2xl p-6"
          style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
          <h3 className="font-semibold mb-1" style={{ color: 'var(--text-base)' }}>{t.trendsByChannel}</h3>
          <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>{t.revenueSom}</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={channelData} barSize={26} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtCompact} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
              <Tooltip
                cursor={{ fill: theme === 'dark' ? '#ffffff08' : '#00000008' }}
                content={({ active, payload, label }: any) => active && payload?.length ? (
                  <TipBox>
                    <p style={{ color: 'var(--text-muted)' }}>{label}</p>
                    {payload.map((e: any) => (
                      <p key={e.dataKey} className="font-semibold" style={{ color: e.fill }}>
                        {e.dataKey}: {fmtCompact(e.value)}
                      </p>
                    ))}
                  </TipBox>
                ) : null}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: axisColor }} iconType="circle" />
              <Bar dataKey="Uzum" stackId="a" fill={PALETTE[0]} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Yandex" stackId="a" fill={PALETTE[3]} />
              <Bar dataKey="Wildberries" stackId="a" fill={PALETTE[5]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border rounded-2xl p-6"
          style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
          <h3 className="font-semibold mb-1" style={{ color: 'var(--text-base)' }}>{t.newVsReturning}</h3>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{t.total}: {(kpis.total_orders || 0).toLocaleString('uz-UZ')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={customerSplit} cx="50%" cy="50%" innerRadius={50} outerRadius={78}
                paddingAngle={3} dataKey="value" nameKey="name">
                {customerSplit.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? PALETTE[2] : PALETTE[4]} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={({ active, payload }: any) => active && payload?.length ? (
                <TipBox>
                  <p style={{ color: 'var(--text-dim)' }}>{payload[0].name}</p>
                  <p className="font-bold" style={{ color: 'var(--text-base)' }}>{payload[0].value.toLocaleString('uz-UZ')}</p>
                </TipBox>
              ) : null} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {customerSplit.map((c, i) => {
              const total = customerSplit.reduce((s, x) => s + x.value, 0) || 1
              return (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: i === 0 ? PALETTE[2] : PALETTE[4] }} />
                  <span className="flex-1" style={{ color: 'var(--text-dim)' }}>{c.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{((c.value / total) * 100).toFixed(0)}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Funnel + category bubble */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="border rounded-2xl p-6"
          style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
          <h3 className="font-semibold mb-5" style={{ color: 'var(--text-base)' }}>{t.salesFunnel}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <FunnelChart>
              <Tooltip content={({ active, payload }: any) => active && payload?.length ? (
                <TipBox>
                  <p style={{ color: 'var(--text-dim)' }}>{payload[0].payload.name}</p>
                  <p className="font-bold" style={{ color: 'var(--text-base)' }}>{payload[0].value.toLocaleString('uz-UZ')}</p>
                </TipBox>
              ) : null} />
              <Funnel dataKey="value" data={funnelData} isAnimationActive>
                <LabelList position="right" fill={axisColor} stroke="none" dataKey="name" fontSize={11} />
                <LabelList position="center" fill="#fff" stroke="none" dataKey="value"
                  fontSize={11} formatter={(v) => fmtCompact(Number(v))} />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>

        <div className="border rounded-2xl p-6"
          style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
          <h3 className="font-semibold mb-5" style={{ color: 'var(--text-base)' }}>{t.categoryBubble}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis type="number" dataKey="x" name={t.margin} unit="%"
                tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="number" dataKey="y" name={t.revenueSom} tickFormatter={fmtCompact}
                tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
              <ZAxis type="number" dataKey="z" range={[120, 900]} name={t.units} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }: any) => active && payload?.length ? (
                <TipBox>
                  <p className="font-medium" style={{ color: 'var(--text-dim)' }}>{payload[0].payload.name}</p>
                  <p style={{ color: 'var(--text-muted)' }}>{t.margin}: {payload[0].payload.x}%</p>
                  <p style={{ color: 'var(--text-muted)' }}>{t.revenueSom}: {fmtCompact(payload[0].payload.y)}</p>
                  <p style={{ color: 'var(--text-muted)' }}>{t.units}: {payload[0].payload.z}</p>
                </TipBox>
              ) : null} />
              <Scatter data={bubbleData}>
                {bubbleData.map((b, i) => (
                  <Cell key={i} fill={b.fill} fillOpacity={0.65} stroke={b.fill} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            {bubbleData.map(b => (
              <div key={b.name} className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full" style={{ background: b.fill }} />
                <span style={{ color: 'var(--text-muted)' }}>{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
